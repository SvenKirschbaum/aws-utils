import * as cdk from 'aws-cdk-lib';
import {CfnOutput, Duration, Fn, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {HttpApi} from "@aws-cdk/aws-apigatewayv2-alpha";
import {HttpLambdaIntegration} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {AaaaRecord, ARecord, HostedZone, PublicHostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation, DnsValidatedCertificate} from "aws-cdk-lib/aws-certificatemanager";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {Secret} from "aws-cdk-lib/aws-secretsmanager";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {
  CachePolicy,
  Distribution,
  HttpVersion,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {HttpOrigin} from "aws-cdk-lib/aws-cloudfront-origins";

export interface LogRedirectStackProps extends cdk.StackProps {
  domainName: string,
  wclTokenSecretName: string
}

export class LogRedirectUSEast1Stack extends cdk.Stack {
  readonly hostedZone: HostedZone;
  readonly certificate: Certificate;

  constructor(scope: Construct, id: string, props: StackProps & {domainName: string}) {
    super(scope, id, props);

    //DNS
    this.hostedZone = new PublicHostedZone(this, 'HostedZone', {
      zoneName: props.domainName,
    });

    new CfnOutput(this, 'Nameserver', {
      exportName: 'Nameserver',
      value: Fn.join(' ', this.hostedZone.hostedZoneNameServers as string[])
    })

    //Certificate
    this.certificate = new Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    });
  }
}

export class LogRedirectStack extends cdk.Stack {

  private props: LogRedirectStackProps;
  private httpApi: HttpApi;
  private globalResources: LogRedirectUSEast1Stack;

  constructor(scope: Construct, id: string, props: LogRedirectStackProps) {
    super(scope, id, {
      ...props,
      crossRegionReferences: true
    });

    this.props = props;

    this.globalResources = new LogRedirectUSEast1Stack(scope, id+'GlobalResources', {
      domainName: this.props.domainName,
      env: {
        account: this.props.env?.account,
        region: 'us-east-1'
      },
      crossRegionReferences: true
    })

    this.createApi();
    this.createApiRoutes();
  }

  private createApi() {

    this.httpApi = new HttpApi(this, 'HttpApi');

    const distribution = new Distribution(this, 'Distribution', {
      certificate: this.globalResources.certificate,
      domainNames: [this.props.domainName],
      defaultBehavior: {
        origin: new HttpOrigin(Fn.select(2, Fn.split('/', this.httpApi.apiEndpoint))),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
    })

    new ARecord(this, 'ARecord', {
      zone: this.globalResources.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    });

    new AaaaRecord(this, 'AAAARecord', {
      zone: this.globalResources.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
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
