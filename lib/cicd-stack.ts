import {Arn, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
    Effect,
    FederatedPrincipal,
    OpenIdConnectProvider,
    PolicyStatement,
    Role
} from "aws-cdk-lib/aws-iam";
export class CICDStack extends Stack {
    private githubProvider: OpenIdConnectProvider;
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        this.addGithubActionsIdentityProvider();
        this.addGithubActionPermissions();
    }

    private addGithubActionsIdentityProvider() {
        this.githubProvider = new OpenIdConnectProvider(this, 'github-actions-oidc-provider', {
            url: 'https://token.actions.githubusercontent.com',
            thumbprints: ['1b511abead59c6ce207077c0bf0e0043b1382612'],
            clientIds: ['sts.amazonaws.com']
        });
    }

    private addGithubActionPermissions() {
        const githubActionsRole = new Role(this, 'github-utils-actions-role', {
            roleName: 'GithubActionsUtilsRole',
            assumedBy: new FederatedPrincipal(
                this.githubProvider.openIdConnectProviderArn,
                {
                    "StringEquals": {
                        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                        "token.actions.githubusercontent.com:sub": "repo:SvenKirschbaum/aws-utils:ref:refs/heads/master",
                    }
                }
            ),
        });

        githubActionsRole.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: [
                // Current (Utils) Account cdk Roles
                Arn.format({
                    service: 'iam',
                    region: '',
                    resource: 'role',
                    resourceName: 'cdk-*'
                }, Stack.of(this)),
                // DNS Account cdk Roles
                Arn.format({
                    service: 'iam',
                    account: '058264224454',
                    region: '',
                    resource: 'role',
                    resourceName: 'cdk-*'
                }, Stack.of(this))
            ]
        }));
    }
}
