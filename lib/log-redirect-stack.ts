import * as cdk from 'aws-cdk-lib';
import {Duration, Fn} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {HttpApi} from "@aws-cdk/aws-apigatewayv2-alpha";
import {HttpLambdaIntegration} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {HostedZone, RecordType} from "aws-cdk-lib/aws-route53";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {Secret} from "aws-cdk-lib/aws-secretsmanager";
import {
  CachePolicy,
  Distribution,
  HttpVersion,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {HttpOrigin} from "aws-cdk-lib/aws-cloudfront-origins";
import {Role} from "aws-cdk-lib/aws-iam";
import {DnsValidatedCertificate} from "@trautonen/cdk-dns-validated-certificate";
import {R53DelegationRoleInfo} from "./constructs/util";
import {CrossAccountRoute53RecordSet} from "@fallobst22/cdk-cross-account-route53";

export interface LogRedirectStackProps extends cdk.StackProps {
  domainName: string,
  wclTokenSecretName: string,
  dnsDelegation: R53DelegationRoleInfo
}

export class LogRedirectStack extends cdk.Stack {

  private props: LogRedirectStackProps;
  private httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: LogRedirectStackProps) {
    super(scope, id, props);

    this.props = props;

    this.createApi();
    this.createApiRoutes();
  }

  private createApi() {

    const certificate = new DnsValidatedCertificate(this, 'Certificate', {
      hostedZone: HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: this.props.dnsDelegation.hostedZoneId,
        zoneName: this.props.domainName
      }),
      domainName: this.props.domainName,
      validationRole: Role.fromRoleArn(this, 'CertificateValidationRole', 'arn:aws:iam::' + this.props.dnsDelegation.account + ':role/' + this.props.dnsDelegation.roleName, {
        mutable: false
      }),
      certificateRegion: 'us-east-1'
    })

    this.httpApi = new HttpApi(this, 'HttpApi');

    const distribution = new Distribution(this, 'Distribution', {
      certificate,
      domainNames: [this.props.domainName],
      defaultBehavior: {
        origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.httpApi.apiEndpoint))),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
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

  private createApiRoutes() {
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

  }
}
