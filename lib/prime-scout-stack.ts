import * as cdk from "aws-cdk-lib";
import {Duration, Fn, RemovalPolicy} from "aws-cdk-lib";
import {R53DelegationRoleInfo} from "./constructs/util";
import {Construct} from "constructs";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {HostedZone, IHostedZone, RecordType} from "aws-cdk-lib/aws-route53";
import {Role} from "aws-cdk-lib/aws-iam";
import {CorsHttpMethod, HttpApi, HttpMethod} from "aws-cdk-lib/aws-apigatewayv2";
import {
    AllowedMethods, CacheHeaderBehavior,
    CachePolicy,
    Distribution,
    HttpVersion,
    OriginAccessIdentity,
    ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {HttpOrigin, S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";
import {BlockPublicAccess, Bucket, BucketEncryption} from "aws-cdk-lib/aws-s3";
import {BucketDeployment, CacheControl, Source} from "aws-cdk-lib/aws-s3-deployment";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";

export interface PrimeScoutStackProps extends cdk.StackProps {
    domainName: string,
    dnsDelegation: R53DelegationRoleInfo
}

export class PrimeScoutStack extends cdk.Stack {
    private props: PrimeScoutStackProps;
    private hostedZone: IHostedZone;

    constructor(scope: Construct, id: string, props: PrimeScoutStackProps) {
        super(scope, id, props);

        this.props = props;
        this.hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: this.props.dnsDelegation.hostedZoneId,
            zoneName: this.props.domainName
        })

        this.createApi();
        this.createFrontend();
    }

    private createApi() {
        const certificate = new DnsValidatedCertificate(this, 'ApiCertificate', {
            validationHostedZones: [{
                hostedZone: this.hostedZone,
                validationRole: Role.fromRoleArn(this, 'ApiCertificateValidationRole', 'arn:aws:iam::' + this.props.dnsDelegation.account + ':role/' + this.props.dnsDelegation.roleName, {
                    mutable: false
                })
            }],
            domainName: `api.${this.props.domainName}`,
            certificateRegion: 'us-east-1'
        })

        const httpApi = new HttpApi(this, 'HttpApi', {
            corsPreflight: {
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                ],
                allowMethods: [CorsHttpMethod.ANY],
                allowOrigins: ['*'],
                maxAge: Duration.days(1),
            },
        });

        const scoutFunction = new NodejsFunction(this, 'ScoutFunction', {
            entry: 'lambda/prime-scout/src/scout.ts',
            runtime: Runtime.NODEJS_18_X,
            architecture: Architecture.ARM_64,
            logRetention: RetentionDays.THREE_DAYS,
            timeout: Duration.seconds(10),
            tracing: Tracing.ACTIVE,
            memorySize: 1769,
            depsLockFilePath: 'lambda/prime-scout/package-lock.json',
            bundling: {
                nodeModules: ['jsdom'],
            }
        });

        httpApi.addRoutes({
            path: '/scout',
            methods: [HttpMethod.POST],
            integration:  new HttpLambdaIntegration('ScoutIntegration', scoutFunction)
        });

        const distribution = new Distribution(this, 'ApiDistribution', {
            certificate,
            domainNames: [`api.${this.props.domainName}`],
            defaultBehavior: {
                origin: new HttpOrigin(Fn.select(2, Fn.split('/', httpApi.apiEndpoint))),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                cachePolicy: new CachePolicy(this, 'CachePolicy', {
                    minTtl: Duration.seconds(0),
                    defaultTtl: Duration.seconds(0),
                    maxTtl: Duration.minutes(30),
                    headerBehavior: CacheHeaderBehavior.allowList('Authorization', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'),
                }),
            },
            httpVersion: HttpVersion.HTTP2_AND_3,
        });

        new CrossAccountRoute53RecordSet(this, 'ApiDNSRecords', {
            delegationRoleName: this.props.dnsDelegation.roleName,
            delegationRoleAccount: this.props.dnsDelegation.account,
            hostedZoneId: this.props.dnsDelegation.hostedZoneId,
            resourceRecordSets: [
                {
                    Name: `api.${this.props.domainName}`,
                    Type: RecordType.A,
                    AliasTarget: {
                        DNSName: distribution.distributionDomainName,
                        HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
                        EvaluateTargetHealth: false,
                    },
                },
                {
                    Name: `api.${this.props.domainName}`,
                    Type: RecordType.AAAA,
                    AliasTarget: {
                        DNSName: distribution.distributionDomainName,
                        HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
                        EvaluateTargetHealth: false,
                    },
                }
            ],
        });
    }

    private createFrontend() {
        const bucket = new Bucket(this, 'FrontendBucket', {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            encryption: BucketEncryption.S3_MANAGED
        });

        new BucketDeployment(this, 'FrontendDeployment', {
            destinationBucket: bucket,
            exclude: ['index.html'],
            sources: [
                Source.asset('./frontend/prime-scout/build', {
                    // Exclude files from bundling
                    exclude: ['*.map', 'index.html'],
                }),
            ],
            cacheControl: [
                CacheControl.fromString('public, max-age=31536000, immutable'),
            ],

        });

        new BucketDeployment(this, 'ConfigDeployment', {
            destinationBucket: bucket,
            // Exclude everything not related to this deployment to prevent other files from being deleted
            exclude: ['*'],
            include: ['index.html'],
            sources: [
                Source.asset('./frontend/prime-scout/build', {
                    // Bundle only index.html
                    exclude: ['*', '!index.html'],
                })
            ],
            cacheControl: [
                CacheControl.fromString('public, max-age=300'),
            ],
        });

        const certificate = new DnsValidatedCertificate(this, 'FrontendCertificate', {
            validationHostedZones: [{
                hostedZone: this.hostedZone,
                validationRole: Role.fromRoleArn(this, 'FrontendCertificateValidationRole', 'arn:aws:iam::' + this.props.dnsDelegation.account + ':role/' + this.props.dnsDelegation.roleName, {
                    mutable: false
                })
            }],
            domainName: this.props.domainName,
            certificateRegion: 'us-east-1'
        })

        const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
        bucket.grantRead(originAccessIdentity);

        const origin = new S3Origin(bucket, {
            originAccessIdentity,
        });

        const distribution = new Distribution(this, 'FrontendDistribution', {
            certificate,
            domainNames: [this.props.domainName],
            defaultRootObject: 'index.html',

            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],

            defaultBehavior: {
                origin,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
                    minTtl: Duration.seconds(1),
                    defaultTtl: Duration.days(365),
                    maxTtl: Duration.days(365),
                }),
            },
            httpVersion: HttpVersion.HTTP2_AND_3,
        });

        new CrossAccountRoute53RecordSet(this, 'FrontendDNSRecords', {
            delegationRoleName: this.props.dnsDelegation.roleName,
            delegationRoleAccount: this.props.dnsDelegation.account,
            hostedZoneId: this.props.dnsDelegation.hostedZoneId,
            resourceRecordSets: [
                {
                    Name: this.props.domainName,
                    Type: RecordType.A,
                    AliasTarget: {
                        DNSName: distribution.distributionDomainName,
                        HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
                        EvaluateTargetHealth: false,
                    },
                },
                {
                    Name: this.props.domainName,
                    Type: RecordType.AAAA,
                    AliasTarget: {
                        DNSName: distribution.distributionDomainName,
                        HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
                        EvaluateTargetHealth: false,
                    },
                }
            ],
        });
    }
}