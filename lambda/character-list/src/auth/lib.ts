import {Issuer, TokenSet} from "openid-client";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {tracer} from "../util";
import * as jose from "jose";

const client = tracer.captureAWSv3Client(new SecretsManagerClient({region: process.env.AWS_REGION}));

export interface OAuthCredentials {
    client_id: string,
    client_secret: string,
    session_key: string,
}

export interface Environment {
    OAUTH_CREDENTIALS_SECRET_ARN: string,
    BASE_DOMAIN: string,
}

let __secret_value: OAuthCredentials | undefined = undefined;

export async function getOAuthCredentials() {
    if(__secret_value) return __secret_value;

    const token = await client.send(new GetSecretValueCommand({
        SecretId: process.env.OAUTH_CREDENTIALS_SECRET_ARN,
    }));

    if(!token.SecretString) throw new Error('Secret is empty');

    __secret_value = JSON.parse(token.SecretString) as OAuthCredentials;

    return __secret_value;
}

export const REDIRECT_URL = `https://${process.env.BASE_DOMAIN}/api/auth/callback`;

export async function getOAuthClient() {
    const [battleNetIssuer, credentials] = await Promise.all([
        Issuer.discover('https://oauth.battle.net/'),
        getOAuthCredentials()
    ]);

    return new battleNetIssuer.Client({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        redirect_uris: [REDIRECT_URL],
        response_types: ['code'],
    });
}

export async function getSessionKey() {
    const credentials = await getOAuthCredentials();
    return jose.base64url.decode(credentials.session_key);
}