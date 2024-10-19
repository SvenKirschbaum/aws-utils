import * as oauthClient from "openid-client";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {tracer} from "../util";
import * as jose from "jose";

const secretsClient = tracer.captureAWSv3Client(new SecretsManagerClient({region: process.env.AWS_REGION}));

const OAUTH_REDIRECT_URL = `https://${process.env.BASE_DOMAIN}/api/auth/callback`;
const OAUTH_CODE_CHALLENGE_METHOD = 'S256';
const OAUTH_SCOPES = 'openid wow.profile';

interface OAuthCredentials {
    client_id: string,
    client_secret: string,
    session_key: string,
}

interface Environment {
    OAUTH_CREDENTIALS_SECRET_ARN: string,
    BASE_DOMAIN: string,
}

// Caching getter for the OAuth credentials
let __secret_value: OAuthCredentials | undefined = undefined;
async function getOAuthCredentials() {
    if(__secret_value) return __secret_value;

    const token = await secretsClient.send(new GetSecretValueCommand({
        SecretId: process.env.OAUTH_CREDENTIALS_SECRET_ARN,
    }));

    if(!token.SecretString) throw new Error('Secret is empty');

    __secret_value = JSON.parse(token.SecretString) as OAuthCredentials;

    return __secret_value;
}

async function getSessionKey() {
    const credentials = await getOAuthCredentials();
    return jose.base64url.decode(credentials.session_key);
}

// Caching getter for the OAuth configuration
let __oauth_config: oauthClient.Configuration | undefined = undefined;
async function getOAuthConfig() {
    if(__oauth_config) return __oauth_config;

    const credentials = await getOAuthCredentials();
    const config = await oauthClient.discovery(
        new URL('https://oauth.battle.net/'),
        credentials.client_id,
        credentials.client_secret
    );

    __oauth_config = config;

    return config;
}

export interface OAuthStartData {
    // The URL to redirect the user to
    clientRedirectURL: URL,
    // The state to store in the user's session
    clientContext: string,
}

interface OAuthContext {
    code_verifier: string,
    state: string,
}

export async function startOAuthAuthorization(): Promise<OAuthStartData> {
    const config = await getOAuthConfig();

    let code_verifier = oauthClient.randomPKCECodeVerifier()
    let code_challenge = await oauthClient.calculatePKCECodeChallenge(code_verifier)

    let parameters: Record<string, string> = {
        redirect_uri: OAUTH_REDIRECT_URL,
        scope: OAUTH_SCOPES,
        code_challenge,
        code_challenge_method: OAUTH_CODE_CHALLENGE_METHOD,
    }

    if (!config.serverMetadata().supportsPKCE()) {
        parameters.state = oauthClient.randomState()
    }

    const context: OAuthContext = {
        code_verifier,
        state: parameters.state,
    }
    const contextString = await new jose.EncryptJWT(context as unknown as jose.JWTPayload)
        .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
        .setIssuedAt()
        .setIssuer(process.env.BASE_DOMAIN as string)
        .setAudience(process.env.BASE_DOMAIN as string)
        .setExpirationTime("1h")
        .encrypt(await getSessionKey())

    return {
        clientRedirectURL: oauthClient.buildAuthorizationUrl(config, parameters),
        clientContext: contextString,
    }
}

export interface OAuthSessionData {
    clientSession: string
    expires_in: number
}
export interface SessionPayload {
    battleNet: oauthClient.TokenEndpointResponse & oauthClient.TokenEndpointResponseHelpers,
}
export async function finishOAuthAuthorization(requestURL: URL, clientContext: string): Promise<OAuthSessionData> {
    const config = await getOAuthConfig();

    const { payload } = await jose.jwtDecrypt(clientContext, await getSessionKey(), {
        issuer: process.env.BASE_DOMAIN as string,
        audience: process.env.BASE_DOMAIN as string,
    });
    const context = payload as unknown as OAuthContext;

    let tokens = await oauthClient.authorizationCodeGrant(config, requestURL, {
        pkceCodeVerifier: context.code_verifier,
        expectedState: context.state,
        idTokenExpected: true,
    });

    const sessionPayload: SessionPayload = {
        battleNet: tokens,
    }
    const jwt = await new jose.EncryptJWT(sessionPayload as unknown as jose.JWTPayload)
        .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
        .setIssuedAt()
        .setIssuer(process.env.BASE_DOMAIN as string)
        .setAudience(process.env.BASE_DOMAIN as string)
        .setExpirationTime(tokens.expires_in as number)
        .encrypt(await getSessionKey());

    return {
        clientSession: jwt,
        expires_in: tokens.expiresIn() as number,
    }
}

export async function parseSession(jwt: string): Promise<SessionPayload> {
    const { payload } = await jose.jwtDecrypt(jwt, await getSessionKey(), {
        issuer: process.env.BASE_DOMAIN as string,
        audience: process.env.BASE_DOMAIN as string,
    });

    return payload as unknown as SessionPayload;
}