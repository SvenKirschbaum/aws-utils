import * as cdk from "aws-cdk-lib";
import {DNSStack} from "../lib/dns-stack";
import {dnsAccountEnv} from "./constants";

const app = new cdk.App();

new DNSStack(app, 'DNSStack', {
    env: dnsAccountEnv
})