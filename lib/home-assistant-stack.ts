import {Stack, StackProps} from "aws-cdk-lib";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {Construct} from "constructs";
import {PythonFunction} from '@aws-cdk/aws-lambda-python-alpha';


export interface HomeAssistantStackProps extends StackProps {
    baseUrl: string;
}

export class HomeAssistantStack extends Stack {
    constructor(scope: Construct, id: string, props: HomeAssistantStackProps) {
        super(scope, id, {
            ...props,
        });

        new PythonFunction(this, 'HomeAssistantFunction', {
            entry: 'lambda/home-assistant',
            runtime: Runtime.PYTHON_3_12,
            environment: {
                "BASE_URL": props.baseUrl,
            }
        });


    }
}
