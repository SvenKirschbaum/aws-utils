import * as cdk from "aws-cdk-lib";
import {HomeAssistantStack} from "../lib/home-assistant-stack";
import {dnsAccountID} from "./constants";

const app = new cdk.App();

new HomeAssistantStack(app, 'HomeAssistantStack', {
    env: {
        account: dnsAccountID,
        region: 'eu-west-1'
    },
    baseUrl: "https://home-assistant.home.kirschbaum.me",
})