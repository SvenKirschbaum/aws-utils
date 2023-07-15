import {Construct} from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as r53 from "aws-cdk-lib/aws-route53";

export interface R53DelegationRoleRecord {
    readonly types?: (keyof typeof r53.RecordType)[];
    readonly domains: string[];
}
export interface R53DelegationRoleProps {
    readonly roleName: string;
    readonly assumedBy: iam.IPrincipal;
    readonly zone: r53.IHostedZone;
    readonly records: R53DelegationRoleRecord[]
}

export interface R53DelegationInfo {
    roleName: string,
    account: string,
    hostedZoneId: string,
}

/**
 * Implementation is based on: https://github.com/johnf/cdk-cross-account-route53/blob/main/src/index.ts
 */
export class R53DelegationRole extends Construct {

    constructor(scope: Construct, id: string, props: R53DelegationRoleProps) {
        super(scope, id);

        const statements = props.records.flatMap((r) => {
            const statements = [];

            statements.push(new iam.PolicyStatement({
                actions: ['route53:ChangeResourceRecordSets'],
                resources: [props.zone.hostedZoneArn],
                conditions: {
                    'ForAllValues:StringEquals': {
                        'route53:ChangeResourceRecordSetsRecordTypes': r.types || [r53.RecordType.A, r53.RecordType.AAAA]
                    },
                    'ForAllValues:StringLike': {
                        'route53:ChangeResourceRecordSetsNormalizedRecordNames': r.domains.map(this.normalizeDomain)
                    }
                }
            }));

            return statements;
        });

        statements.push(new iam.PolicyStatement({
            actions: ['route53:ListHostedZonesByName'],
            resources: [props.zone.hostedZoneArn],
        }));

        // Can we be more specific here?
        statements.push(new iam.PolicyStatement({
            actions: ['route53:GetChange'],
            resources: ['*'],
        }));

        new iam.Role(this, 'DelegationRole', {
            roleName: props.roleName,
            assumedBy: props.assumedBy,
            inlinePolicies: {
                delegation: new iam.PolicyDocument({
                    statements
                })
            }
        })
    }

    private normalizeDomain(name: string) {
        return name
            .replace(/\.$/, '')
            .toLowerCase()
            .split('').map((char) => {
                if (char.match(/[a-z0-9\\*_.-]/)) {
                    return char;
                }

                const octal = '000' + char.charCodeAt(0).toString(8);
                return `\\${octal.substring(octal.length - 3)}`;
            })
            .join('');
    }
}
