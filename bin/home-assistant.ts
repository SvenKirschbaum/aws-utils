import * as cdk from "aws-cdk-lib";
import {HomeAssistantStack} from "../lib/home-assistant-stack";
import {utilAccountID} from "./constants";

const app = new cdk.App();

new HomeAssistantStack(app, 'HomeAssistantStack', {
    env: {
        account: utilAccountID,
        region: 'eu-west-1'
    },
    baseUrl: "https://home-assistant.home.kirschbaum.me",
    skillId: "amzn1.ask.skill.3100a6bd-e648-42c9-957e-e4482b868e15",
})