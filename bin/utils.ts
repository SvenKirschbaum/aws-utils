#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LogRedirectStack } from '../lib/log-redirect-stack';
import {CIStack} from "../lib/ci-stack";
import {DomainPlaceholderStack} from "../lib/domain-placeholder-stack";
import {DnsStack} from "../lib/dns-stack";
import {PrimeScoutStack} from "../lib/prime-scout-stack";

const utilAccountID = '362408963076';
const dnsAccountID = '058264224454';

const app = new cdk.App();

const utilAccountEnv = {
    region: 'eu-central-1',
    account: utilAccountID
}

const ciStack = new CIStack(app, 'CIStack', {
    env: utilAccountEnv
});

new DnsStack(app, 'DNSStack', {
    // WARNING: The Zones have been manually created with a reusable delegation set.
    // Further zones should follow the same procedure, to use the same white-label nameservers.
    // The create-hosted-zone script can be used to create a new zone, and the update-default-records
    // script can be used to update the SOA and NS records.
    domains: [
        'elite12.de',
        'kirschbaum.me',
        'kirschbaum.cloud',
        'bund-von-theramore.de',
        'theramo.re',
        'markus-dope.de',
        'grillteller42.de',
        'trigardon-rg.de',
        'westerwald-esport.de',
    ],
    env: {
        region: 'eu-central-1',
        account: dnsAccountID
    }
})

new LogRedirectStack(app, 'LogRedirectStack', {
    domainName: 'logs.theramo.re',
    wclTokenSecretName: 'wcl-user-token',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'LogsDnsDelegationRole',
        hostedZoneId: 'Z063409814X6LVK19O0XU'
    },
    env: utilAccountEnv
});

new DomainPlaceholderStack(app, 'DomainPlaceholderStack', {
    domainName: 'kirschbaum.cloud',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'DomainPlaceholderDnsDelegationRole',
        hostedZoneId: 'Z0202936UCVSS5ELQXV6'
    },
    env: utilAccountEnv
})

new PrimeScoutStack(app, 'PrimeScoutStack', {
    domainName: 'scout.westerwald-esport.de',
    dnsDelegation: {
        account: dnsAccountID,
        roleName: 'PrimeScoutDnsDelegationRole',
        hostedZoneId: 'Z061068430M8Q8F3V3ROJ'
    },
    env: utilAccountEnv
});
