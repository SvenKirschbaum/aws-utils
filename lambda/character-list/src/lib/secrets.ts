import {tracer} from "./util";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

export const secretsClient = tracer.captureAWSv3Client(new SecretsManagerClient({region: process.env.AWS_REGION}));

interface Environment {
    OAUTH_CREDENTIALS_SECRET_ARN: string,
    RAIDERIO_CREDENTIALS_SECRET_ARN: string,
    ORIGIN_SECRET_ARN: string,
    ENCRYPTION_KEY_ARN: string,
    BASE_DOMAIN: string,
    TABLE_NAME: string
}

interface RaiderIOCredentials {
    api_key: string
}

let __raiderio_secret_value: RaiderIOCredentials | undefined = undefined;
export async function getRaiderIOApiKey() {
    if(__raiderio_secret_value) return __raiderio_secret_value;

    const token = await secretsClient.send(new GetSecretValueCommand({
        SecretId: process.env.RAIDERIO_CREDENTIALS_SECRET_ARN,
    }));

    if(!token.SecretString) throw new Error('Secret is empty');

    __raiderio_secret_value = JSON.parse(token.SecretString) as RaiderIOCredentials;

    return __raiderio_secret_value;
}

let __origin_secret_value: string | undefined = undefined;
export async function getOriginSecret() {
    if(__origin_secret_value) return __origin_secret_value;

    const token = await secretsClient.send(new GetSecretValueCommand({
        SecretId: process.env.ORIGIN_SECRET_ARN,
    }));

    if(!token.SecretString) throw new Error('Secret is empty');

    __origin_secret_value = token.SecretString;

    return __origin_secret_value;
}

interface OAuthCredentials {
    client_id: string,
    client_secret: string,
    session_key: string,
}

let __oauth_secret_value: OAuthCredentials | undefined = undefined;
export async function getOAuthCredentials() {
    if (__oauth_secret_value) return __oauth_secret_value;

    const token = await secretsClient.send(new GetSecretValueCommand({
        SecretId: process.env.OAUTH_CREDENTIALS_SECRET_ARN,
    }));

    if (!token.SecretString) throw new Error('Secret is empty');

    __oauth_secret_value = JSON.parse(token.SecretString) as OAuthCredentials;

    return __oauth_secret_value;
}
