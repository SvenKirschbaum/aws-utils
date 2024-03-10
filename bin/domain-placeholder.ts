import * as cdk from "aws-cdk-lib";
import {DomainPlaceholderStack} from "../lib/domain-placeholder-stack";
import {dnsAccountID, utilAccountEnv} from "./constants";

const app = new cdk.App();

new DomainPlaceholderStack(app, 'DomainPlaceholderStack', {
    domainName: 'kirschbaum.cloud',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'DomainPlaceholderDnsDelegationRole',
        hostedZoneId: 'Z0202936UCVSS5ELQXV6'
    },
    env: utilAccountEnv
})