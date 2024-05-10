import * as cdk from 'aws-cdk-lib';
import {R53DelegationRoleInfo} from "./constructs/util";
import {Construct} from "constructs";
import {Duration, RemovalPolicy} from "aws-cdk-lib";
import {BlockPublicAccess, Bucket, BucketEncryption} from "aws-cdk-lib/aws-s3";
import {BucketDeployment, CacheControl, Source} from "aws-cdk-lib/aws-s3-deployment";
import {
    CachePolicy,
    Distribution, HttpVersion,
    OriginAccessIdentity,
    ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {HostedZone, RecordType} from "aws-cdk-lib/aws-route53";
import {Role} from "aws-cdk-lib/aws-iam";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";

export interface CharacterListStackProps extends cdk.StackProps {
    domainName: string,
    dnsDelegation: R53DelegationRoleInfo
}

export class CharacterListStack extends cdk.Stack {

    private props: CharacterListStackProps;
    private frontendOrigin: S3Origin;

    constructor(scope: Construct, id: string, props: CharacterListStackProps) {
        super(scope, id, props);

        this.props = props;

        this.createFrontend();
        this.createDistribution();
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

            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],

            defaultBehavior: frontendBehavior,
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
}