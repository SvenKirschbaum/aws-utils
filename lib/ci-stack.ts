import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

export class CIStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        this.createUtilBuild();
    }

    private createUtilBuild() {
        new codebuild.Project(this, 'Build', {
            source: codebuild.Source.gitHub({
                owner: 'fallobst22',
                repo: 'aws-utils',
                webhook: true,
                webhookFilters: [
                    codebuild.FilterGroup.inEventOf(
                        codebuild.EventAction.PULL_REQUEST_CREATED,
                        codebuild.EventAction.PULL_REQUEST_UPDATED,
                        codebuild.EventAction.PULL_REQUEST_REOPENED,
                    ),
                ],
                reportBuildStatus: true,
            }),
            buildSpec: codebuild.BuildSpec.fromObject({
                version: 0.2,
                phases: {
                    install: {
                        commands: [
                            'npm ci',
                            '(cd lambda/log-redirect && npm ci --unsafe-perm)',
                        ],
                    },
                    build: {
                        commands: [
                            'npx cdk synth',
                        ],
                    },
                },
            }),
            environment: {
                buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
                computeType: codebuild.ComputeType.SMALL,
                privileged: true,
            },
        });
    }
}
