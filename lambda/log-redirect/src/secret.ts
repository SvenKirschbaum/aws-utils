import {tracer} from "./util";
import {GetSecretValueCommand, SecretsManagerClient, UpdateSecretCommand} from "@aws-sdk/client-secrets-manager";

const client = tracer.captureAWSv3Client(new SecretsManagerClient({region: process.env.AWS_REGION}));

export interface SecretValue {
    client_secret: string,
    user_access_token: string,
}

let __secret_value: SecretValue | undefined = undefined;


export async function getSecret() {
    if(__secret_value) return __secret_value;

    const token = await client.send(new GetSecretValueCommand({
        SecretId: process.env.OAUTH_SECRET_ARN
    }));

    if(!token.SecretString) throw new Error('Secret is empty');

    __secret_value = JSON.parse(token.SecretString) as SecretValue;

    return __secret_value;
}

export async function updateUserAccessToken(token: string) {
    const oldValue = await getSecret();

    await client.send(new UpdateSecretCommand({
        SecretId: process.env.OAUTH_SECRET_ARN,
        SecretString: JSON.stringify({...oldValue, user_access_token: token})
    }));

    __secret_value = {...oldValue, user_access_token: token};
}