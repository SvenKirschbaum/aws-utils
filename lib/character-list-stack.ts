import * as cdk from 'aws-cdk-lib';
import {R53DelegationRoleInfo} from "./constructs/util";
import {Construct} from "constructs";
import {Duration, Fn, RemovalPolicy} from "aws-cdk-lib";
import {BlockPublicAccess, Bucket, BucketEncryption} from "aws-cdk-lib/aws-s3";
import {BucketDeployment, CacheControl, Source} from "aws-cdk-lib/aws-s3-deployment";
import {
    CacheCookieBehavior,
    CacheHeaderBehavior,
    CachePolicy,
    CacheQueryStringBehavior,
    Distribution,
    HttpVersion,
    OriginAccessIdentity,
    OriginRequestCookieBehavior,
    OriginRequestHeaderBehavior,
    OriginRequestPolicy,
    OriginRequestQueryStringBehavior,
    ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {HttpOrigin, S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {HostedZone, RecordType} from "aws-cdk-lib/aws-route53";
import {Role} from "aws-cdk-lib/aws-iam";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";
import {HttpApi} from "aws-cdk-lib/aws-apigatewayv2";
import {ISecret, Secret} from "aws-cdk-lib/aws-secretsmanager";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";

export interface CharacterListStackProps extends cdk.StackProps {
    domainName: string,
    battlenetCredentialsSecretName: string,
    raiderIOCredentialsSecretName: string,
    dnsDelegation: R53DelegationRoleInfo
}

export class CharacterListStack extends cdk.Stack {

    private props: CharacterListStackProps;
    private frontendOrigin: S3Origin;
    private httpApi: HttpApi;
    private originSecret: ISecret;

    constructor(scope: Construct, id: string, props: CharacterListStackProps) {
        super(scope, id, props);

        this.props = props;

        this.createFrontend();
        this.createApi();
        this.createDistribution();
    }

    private createFrontend() {
        const bucket = new Bucket(this, 'FrontendBucket', {
            blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
            publicReadAccess: true,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            encryption: BucketEncryption.S3_MANAGED,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html',
        });

        new BucketDeployment(this, 'FrontendDeployment', {
            destinationBucket: bucket,
            exclude: ['index.html'],
            sources: [
                Source.asset('./frontend/character-list/dist', {
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
                Source.asset('./frontend/character-list/dist', {
                    // Bundle only index.html
                    exclude: ['*', '!index.html'],
                })
            ],
            cacheControl: [
                CacheControl.fromString('public, max-age=300'),
            ],
        });

        const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
        bucket.grantRead(originAccessIdentity);

        this.frontendOrigin = new S3Origin(bucket, {
            originAccessIdentity,
        });
    }

    private createDistribution() {
        const certificate = new DnsValidatedCertificate(this, 'Certificate', {
            validationHostedZones: [{
                hostedZone: HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
                    hostedZoneId: this.props.dnsDelegation.hostedZoneId,
                    zoneName: this.props.domainName
                }),
                validationRole: Role.fromRoleArn(this, 'CertificateValidationRole', 'arn:aws:iam::' + this.props.dnsDelegation.account + ':role/' + this.props.dnsDelegation.roleName, {
                    mutable: false
                })
            }],
            domainName: this.props.domainName,
            certificateRegion: 'us-east-1'
        });

        const frontendBehavior = {
            origin: this.frontendOrigin,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
                minTtl: Duration.seconds(1),
                defaultTtl: Duration.days(365),
                maxTtl: Duration.days(365),
            }),
        }

        const distribution = new Distribution(this, 'Distribution', {
            certificate,
            domainNames: [this.props.domainName],
            defaultRootObject: 'index.html',

            defaultBehavior: frontendBehavior,

            additionalBehaviors: {
                '/api/auth/*': {
                    origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.httpApi.apiEndpoint)), {
                        customHeaders: {
                            'X-Origin-Secret': this.originSecret.secretValue.unsafeUnwrap()
                        }
                    }),
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                },
                '/api/*': {
                    origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.httpApi.apiEndpoint)), {
                        originShieldEnabled: true,
                        originShieldRegion: 'eu-central-1',
                        customHeaders: {
                            'X-Origin-Secret': this.originSecret.secretValue.unsafeUnwrap()
                        }
                    }),
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: new CachePolicy(this, 'ApiCachePolicy', {
                        minTtl: Duration.seconds(0),
                        defaultTtl: Duration.seconds(0),
                        maxTtl: Duration.days(1),
                        cookieBehavior: CacheCookieBehavior.allowList('session'),
                        headerBehavior: CacheHeaderBehavior.none(),
                        queryStringBehavior: CacheQueryStringBehavior.none()
                    }),
                    originRequestPolicy: new OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
                        cookieBehavior: OriginRequestCookieBehavior.allowList('session'),
                        headerBehavior: OriginRequestHeaderBehavior.none(),
                        queryStringBehavior: OriginRequestQueryStringBehavior.none()
                    }),
                },
            },
            httpVersion: HttpVersion.HTTP2_AND_3,
        });

        new CrossAccountRoute53RecordSet(this, 'DNSRecords', {
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

    private createApi() {
        this.httpApi = new HttpApi(this, 'HttpApi');
        this.originSecret = new Secret(this, 'CloudfrontOriginSecret');

        const battleNetSecret = Secret.fromSecretNameV2(this, 'BattlenetCredentials', this.props.battlenetCredentialsSecretName);
        const raiderIOSecret = Secret.fromSecretNameV2(this, 'RaiderIOCredentials', this.props.raiderIOCredentialsSecretName);

        const authStartFunction = new NodejsFunction(this, 'AuthStartFunction', {
            entry: 'lambda/character-list/src/auth/start.ts',
            runtime: Runtime.NODEJS_20_X,
            architecture: Architecture.ARM_64,
            logRetention: RetentionDays.THREE_DAYS,
            timeout: Duration.seconds(10),
            tracing: Tracing.ACTIVE,
            memorySize: 1769,
            environment: {
                'BASE_DOMAIN': this.props.domainName,
                'OAUTH_CREDENTIALS_SECRET_ARN': battleNetSecret.secretArn,
                'ORIGIN_SECRET_ARN': this.originSecret.secretArn,
            }
        });
        battleNetSecret.grantRead(authStartFunction);
        this.originSecret.grantRead(authStartFunction);

        this.httpApi.addRoutes({
            path: '/api/auth/start',
            integration:  new HttpLambdaIntegration('AuthStartIntegration', authStartFunction)
        });

        const authCallbackFunction = new NodejsFunction(this, 'AuthCallbackFunction', {
            entry: 'lambda/character-list/src/auth/callback.ts',
            runtime: Runtime.NODEJS_20_X,
            architecture: Architecture.ARM_64,
            logRetention: RetentionDays.THREE_DAYS,
            timeout: Duration.seconds(10),
            tracing: Tracing.ACTIVE,
            memorySize: 1769,
            environment: {
                'BASE_DOMAIN': this.props.domainName,
                'OAUTH_CREDENTIALS_SECRET_ARN': battleNetSecret.secretArn,
                'ORIGIN_SECRET_ARN': this.originSecret.secretArn,
                'POWERTOOLS_TRACER_CAPTURE_RESPONSE': 'false', // Response contains sensitive data
            }
        });
        battleNetSecret.grantRead(authCallbackFunction);
        this.originSecret.grantRead(authCallbackFunction);

        this.httpApi.addRoutes({
            path: '/api/auth/callback',
            integration:  new HttpLambdaIntegration('AuthCallbackIntegration', authCallbackFunction)
        });

        const listCharactersFunction = new NodejsFunction(this, 'ListCharactersFunction', {
            entry: 'lambda/character-list/src/characters.ts',
            runtime: Runtime.NODEJS_20_X,
            architecture: Architecture.ARM_64,
            logRetention: RetentionDays.THREE_DAYS,
            timeout: Duration.seconds(10),
            tracing: Tracing.ACTIVE,
            memorySize: 1769,
            environment: {
                'BASE_DOMAIN': this.props.domainName,
                'OAUTH_CREDENTIALS_SECRET_ARN': battleNetSecret.secretArn,
                'RAIDERIO_CREDENTIALS_SECRET_ARN': raiderIOSecret.secretArn,
                'ORIGIN_SECRET_ARN': this.originSecret.secretArn,
                'POWERTOOLS_TRACER_CAPTURE_RESPONSE': 'false', // Response is usually to large
            }
        });
        battleNetSecret.grantRead(listCharactersFunction);
        raiderIOSecret.grantRead(listCharactersFunction);
        this.originSecret.grantRead(listCharactersFunction);

        this.httpApi.addRoutes({
            path: '/api/characters/{region}',
            integration:  new HttpLambdaIntegration('ListCharactersIntegration', listCharactersFunction)
        });
    }
}