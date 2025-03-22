import {tracer} from "./util";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

export const secretsClient = tracer.captureAWSv3Client(new SecretsManagerClient({region: process.env.AWS_REGION}));

interface Environment {
    OAUTH_CREDENTIALS_SECRET_ARN: string,
    RAIDERIO_CREDENTIALS_SECRET_ARN: string,
    BASE_DOMAIN: string,
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