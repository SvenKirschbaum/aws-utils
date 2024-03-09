import * as cdk from "aws-cdk-lib";
import {CICDStack} from "../lib/cicd-stack";
import {utilAccountEnv} from "./constants";

const app = new cdk.App();

new CICDStack(app, 'CICDStack', {
    env: utilAccountEnv
});