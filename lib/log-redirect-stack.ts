import * as cdk from 'aws-cdk-lib';
import {CfnOutput, Duration, Fn} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {DomainName, HttpApi} from "@aws-cdk/aws-apigatewayv2-alpha";
import {HttpLambdaIntegration} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {ARecord, HostedZone, PublicHostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {Architecture, Runtime, Tracing} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {Secret} from "aws-cdk-lib/aws-secretsmanager";
import {ApiGatewayv2DomainProperties} from "aws-cdk-lib/aws-route53-targets";

interface LogRedirectStackProps extends cdk.StackProps {
  domainName: string,
  wclTokenSecretName: string,
}

export class LogRedirectStack extends cdk.Stack {

  private props: LogRedirectStackProps;
  private hostedZone: HostedZone;
  private httpApi: HttpApi;
  constructor(scope: Construct, id: string, props: LogRedirectStackProps) {
    super(scope, id, props);

    this.props = props;

    this.createDNS();
    this.createApi();
    this.createApiRoutes();
  }

  private createDNS() {
    this.hostedZone = new PublicHostedZone(this, 'HostedZone', {
      zoneName: this.props.domainName,
    });

    new CfnOutput(this, 'Nameserver', {
      exportName: 'Nameserver',
      value: Fn.join(' ', this.hostedZone.hostedZoneNameServers as string[])
    })
  }

  private createApi() {
    const certificate = new Certificate(this, 'Certificate', {
      domainName: this.props.domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    });

    const domainName = new DomainName(this, 'DomainName', {
      domainName: this.props.domainName,
      certificate
    });

    this.httpApi = new HttpApi(this, 'HttpApi', {
      defaultDomainMapping: {
        domainName,
      }
    });

    new ARecord(this, 'ARecord', {
      zone: this.hostedZone,
      target: RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(domainName.regionalDomainName, domainName.regionalHostedZoneId))
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
