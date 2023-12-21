import {Duration, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {BucketDeployment, Source} from "aws-cdk-lib/aws-s3-deployment";
import {
    CachePolicy,
    Distribution, HeadersFrameOption, HeadersReferrerPolicy,
    HttpVersion,
    ResponseHeadersPolicy,
    ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {HostedZone, RecordType} from "aws-cdk-lib/aws-route53";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {Role} from "aws-cdk-lib/aws-iam";
import {R53DelegationRoleInfo} from "./constructs/util";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";

export interface DomainPlaceholderStackProps extends StackProps {
    domainName: string,
    dnsDelegation: R53DelegationRoleInfo
}
export class DomainPlaceholderStack extends Stack {

    constructor(scope: Construct, id: string, props: DomainPlaceholderStackProps) {
        super(scope, id, props);

        const bucket = new Bucket(this, 'Bucket', {});

        new BucketDeployment(this, 'BucketDeployment', {
            destinationBucket: bucket,
            sources: [Source.asset('./domain-placeholder')]
        });

        const certificate = new DnsValidatedCertificate(this, 'Certificate', {
            hostedZone: HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
                hostedZoneId: props.dnsDelegation.hostedZoneId,
                zoneName: props.domainName
            }),
            domainName: props.domainName,
            validationRole: Role.fromRoleArn(this, 'CertificateValidationRole', 'arn:aws:iam::' + props.dnsDelegation.account + ':role/' + props.dnsDelegation.roleName, {
                mutable: false
            }),
            certificateRegion: 'us-east-1'
        })

        const distribution = new Distribution(this, 'Distribution', {
            certificate,
            domainNames: [props.domainName],
            httpVersion: HttpVersion.HTTP2_AND_3,
            defaultRootObject: 'index.html',
            defaultBehavior: {
                origin: new S3Origin(bucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
                responseHeadersPolicy: new ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
                    securityHeadersBehavior: {
                        strictTransportSecurity: {
                            accessControlMaxAge: Duration.seconds(31536000),
                            includeSubdomains: true,
                            preload: true,
                            override: true,
                        },
                        contentTypeOptions: {
                            override: true,
                        },
                        frameOptions: {
                            frameOption: HeadersFrameOption.DENY,
                            override: true,
                        },
                        xssProtection: {
                            protection: true,
                            override: true,
                            modeBlock: true,
                        },
                        referrerPolicy: {
                            referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                            override: true,
                        },
                    },
                }),
            },
        });

        new CrossAccountRoute53RecordSet(this, 'DNSRecords', {
            delegationRoleName: props.dnsDelegation.roleName,
            delegationRoleAccount: props.dnsDelegation.account,
            hostedZoneId: props.dnsDelegation.hostedZoneId,
            resourceRecordSets: [
                {
                    Name: `kirschbaum.cloud`,
                    Type: RecordType.A,
                    AliasTarget: {
                        DNSName: distribution.distributionDomainName,
                        HostedZoneId: 'Z2FDTNDATAQYW2', // Cloudfront Hosted Zone ID
                        EvaluateTargetHealth: false,
                    },
                },
                {
                    Name: `kirschbaum.cloud`,
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
