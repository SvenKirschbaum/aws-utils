import {CfnOutput, Stack, StackProps} from "aws-cdk-lib";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {Construct} from "constructs";
import {PythonFunction} from '@aws-cdk/aws-lambda-python-alpha';
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Secret} from "aws-cdk-lib/aws-secretsmanager";


export interface HomeAssistantStackProps extends StackProps {
    baseUrl: string;
    skillId: string;
    mTLSCertificateSecretName: string;
}

export class HomeAssistantStack extends Stack {
    constructor(scope: Construct, id: string, props: HomeAssistantStackProps) {
        super(scope, id, {
            ...props,
        });

        const mTLSSecret = Secret.fromSecretNameV2(this, 'MTLSCertificate', props.mTLSCertificateSecretName);

        let pythonFunction = new PythonFunction(this, 'HomeAssistantFunction', {
            entry: 'lambda/home-assistant',
            runtime: Runtime.PYTHON_3_12,
            environment: {
                "BASE_URL": props.baseUrl,
                'MTLS_SECRET_ARN': mTLSSecret.secretArn,
            }
        });
        mTLSSecret.grantRead(pythonFunction)

        pythonFunction.addPermission('InvokePermission', {
            principal: new ServicePrincipal('alexa-connectedhome.amazon.com'),
            eventSourceToken: props.skillId,
        });

        new CfnOutput(this, 'HomeAssistantFunctionArn', {
            value: pythonFunction.functionArn
        });
    }
}
