import * as cdk from "aws-cdk-lib";
import {dnsAccountID, utilAccountEnv} from "./constants";
import {CharacterListStack} from "../lib/character-list-stack";

const app = new cdk.App();

new CharacterListStack(app, 'CharacterListStack', {
    domainName: 'chars.theramo.re',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'CharsDnsDelegationRole',
        hostedZoneId: 'Z063409814X6LVK19O0XU'
    },
    env: utilAccountEnv
});