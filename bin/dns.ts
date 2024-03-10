import * as cdk from "aws-cdk-lib";
import {DNSStack} from "../lib/dns-stack";
import {dnsAccountEnv} from "./constants";

const app = new cdk.App();

new DNSStack(app, 'DNSStack', {
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
    env: dnsAccountEnv
})