import * as cdk from 'aws-cdk-lib';
import {Duration, Fn, RemovalPolicy} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {HttpApi} from "aws-cdk-lib/aws-apigatewayv2";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {HostedZone, RecordType} from "aws-cdk-lib/aws-route53";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {Secret} from "aws-cdk-lib/aws-secretsmanager";
import {
  CachePolicy,
  Distribution,
  HttpVersion,
  ViewerProtocolPolicy,
  OriginRequestPolicy, OriginAccessIdentity
} from "aws-cdk-lib/aws-cloudfront";
import {HttpOrigin, S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {Role} from "aws-cdk-lib/aws-iam";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {R53DelegationRoleInfo} from "./constructs/util";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";
import {BlockPublicAccess, Bucket, BucketEncryption} from "aws-cdk-lib/aws-s3";
import {BucketDeployment, CacheControl, Source} from "aws-cdk-lib/aws-s3-deployment";

export interface LogRedirectStackProps extends cdk.StackProps {
  domainName: string,
  clientId: string,
  wclTokenSecretName: string,
  dnsDelegation: R53DelegationRoleInfo
}

export class LogRedirectStack extends cdk.Stack {

  private props: LogRedirectStackProps;
  private httpApi: HttpApi;
  private frontendOrigin: S3Origin;

  constructor(scope: Construct, id: string, props: LogRedirectStackProps) {
    super(scope, id, props);

    this.props = props;

    this.createApi();
    this.createFrontend();
    this.createDistribution();
  }

  private createApi() {
    this.httpApi = new HttpApi(this, 'HttpApi');

    const secret = Secret.fromSecretNameV2(this, 'UserAuthToken', this.props.wclTokenSecretName);

    const raidFunction = new NodejsFunction(this, 'RaidFunction', {
      entry: 'lambda/log-redirect/src/raid.ts',
      runtime: Runtime.NODEJS_18_X,
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.THREE_DAYS,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      memorySize: 1769,
      environment: {
        'OAUTH_SECRET_ARN': secret.secretArn
      }
    });
    secret.grantRead(raidFunction);

    this.httpApi.addRoutes({
      path: '/raid',
      integration:  new HttpLambdaIntegration('RaidIntegration', raidFunction)
    });

    const mythFunction = new NodejsFunction(this, 'MythFunction', {
      entry: 'lambda/log-redirect/src/mythplus.ts',
      runtime: Runtime.NODEJS_18_X,
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.THREE_DAYS,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      memorySize: 1769,
      environment: {
        'OAUTH_SECRET_ARN': secret.secretArn
      }
    });
    secret.grantRead(mythFunction);

    this.httpApi.addRoutes({
      path: '/mythplus',
      integration:  new HttpLambdaIntegration('MythIntegration', mythFunction),
    })

    const authFunction = new NodejsFunction(this, 'AuthFunction', {
      entry: 'lambda/log-redirect/src/auth.ts',
      runtime: Runtime.NODEJS_18_X,
      architecture: Architecture.ARM_64,
      logRetention: RetentionDays.THREE_DAYS,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      environment: {
        'OAUTH_CLIENT_ID': this.props.clientId,
        'OAUTH_SECRET_ARN': secret.secretArn
      }
    });
    secret.grantRead(authFunction);
    secret.grantWrite(authFunction);

    this.httpApi.addRoutes({
      path: '/auth',
      integration:  new HttpLambdaIntegration('AuthIntegration', authFunction),
    })

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
        Source.asset('./frontend/log-redirect/dist', {
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
        Source.asset('./frontend/log-redirect/dist', {
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

    const apiBehavior = {
      origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.httpApi.apiEndpoint))),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
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
      additionalBehaviors: {
        '/raid': apiBehavior,
        '/mythplus': apiBehavior,
        '/auth': {
          origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.httpApi.apiEndpoint))),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        }
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
}
