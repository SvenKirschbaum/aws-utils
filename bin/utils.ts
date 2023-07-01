#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LogRedirectStack } from '../lib/log-redirect-stack';
import {CIStack} from "../lib/ci-stack";
import {DomainPlaceholderStack} from "../lib/domain-placeholder-stack";

const app = new cdk.App();

const env = {
    region: 'eu-central-1',
    account: '362408963076'
}

new CIStack(app, 'CIStack', {
    env
});

new LogRedirectStack(app, 'LogRedirectStack', {
    domainName: 'logs.theramo.re',
    wclTokenSecretName: 'wcl-user-token',
    env
});

new DomainPlaceholderStack(app, 'DomainPlaceholderStack', {
    domainName: 'kirschbaum.cloud',
    env
})
