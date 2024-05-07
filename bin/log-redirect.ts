import * as cdk from "aws-cdk-lib";
import {LogRedirectStack} from "../lib/log-redirect-stack";
import {dnsAccountID, utilAccountEnv} from "./constants";

const app = new cdk.App();

new LogRedirectStack(app, 'LogRedirectStack', {
    domainName: 'logs.theramo.re',
    clientId: '992544c0-1315-4185-839e-db011e45ff31',
    wclTokenSecretName: 'wcl-auth',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'LogsDnsDelegationRole',
        hostedZoneId: 'Z063409814X6LVK19O0XU'
    },
    env: utilAccountEnv
});