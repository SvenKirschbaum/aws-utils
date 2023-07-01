import {CfnOutput, Duration, Stack, StackProps} from "aws-cdk-lib";
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
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";

export interface DomainPlaceholderStackProps extends StackProps {
    domainName: string
}

class DomainPlaceholderUSEast1Stack extends Stack {
    readonly certificate: Certificate;

    constructor(scope: Construct, id: string, props: DomainPlaceholderStackProps) {
        super(scope, id, props);

        this.certificate = new Certificate(this, 'Certificate', {
            domainName: props.domainName,
            //Note: This requires manual intervention to deploy
            validation: CertificateValidation.fromDns(),
        });
    }
}
export class DomainPlaceholderStack extends Stack {

    constructor(scope: Construct, id: string, props: DomainPlaceholderStackProps) {
        super(scope, id, {
            ...props,
            crossRegionReferences: true
        });

        const globalResources = new DomainPlaceholderUSEast1Stack(scope, 'DomainPlaceholderUSEast1Stack', {
            ...props,
            crossRegionReferences: true,
            env: {
                account: props.env?.account,
                region: 'us-east-1'
            }
        });

        const bucket = new Bucket(this, 'Bucket', {});

        new BucketDeployment(this, 'BucketDeployment', {
            destinationBucket: bucket,
            sources: [Source.asset('./domain-placeholder')]
        });

        const distribution = new Distribution(this, 'Distribution', {
            certificate: globalResources.certificate,
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

        new CfnOutput(this, 'DistributionDomainName', {
            exportName: 'DistributionDomainName',
            value: distribution.distributionDomainName
        });
    }
}
