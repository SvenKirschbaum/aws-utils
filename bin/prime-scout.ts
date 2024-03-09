import * as cdk from "aws-cdk-lib";
import {PrimeScoutStack} from "../lib/prime-scout-stack";
import {dnsAccountID, utilAccountEnv} from "./constants";

const app = new cdk.App();

new PrimeScoutStack(app, 'PrimeScoutStack', {
    domainName: 'scout.westerwald-esport.de',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'PrimeScoutDnsDelegationRole',
        hostedZoneId: 'Z061068430M8Q8F3V3ROJ'
    },
    env: utilAccountEnv
});