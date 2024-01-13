#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LogRedirectStack } from '../lib/log-redirect-stack';
import {CIStack} from "../lib/ci-stack";
import {DomainPlaceholderStack} from "../lib/domain-placeholder-stack";
import {RootDnsStack} from "../lib/root-dns-stack";

const app = new cdk.App();

const env = {
    region: 'eu-central-1',
    account: '362408963076'
}

new RootDnsStack(app, 'RootDns', {
    // WARNING: The Zones have been manually created with a reusable delegation set.
    // Further zones should follow the same procedure, to use the same white-label nameservers.
    // The update-default-records script can be used to update the SOA and NS records.
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
    route53CMKarn: "arn:aws:kms:us-east-1:212836051001:key/e5898e64-5730-47d0-a471-728136cf6d09",
    env: {
        region: 'eu-central-1',
        account: '212836051001'
    }
})

new CIStack(app, 'CIStack', {
    env
});

new LogRedirectStack(app, 'LogRedirectStack', {
    domainName: 'logs.theramo.re',
    wclTokenSecretName: 'wcl-user-token',
    dnsDelegation: {
        account: '212836051001',
        roleName: 'LogsDnsDelegationRole',
        hostedZoneId: 'Z00872631Z0SR25ON2GX1'
    },
    env
});

new DomainPlaceholderStack(app, 'DomainPlaceholderStack', {
    domainName: 'kirschbaum.cloud',
    dnsDelegation: {
        account: '212836051001',
        roleName: 'DomainPlaceholderDnsDelegationRole',
        hostedZoneId: 'Z07030592KWVVKAJQF666'
    },
    env
})
