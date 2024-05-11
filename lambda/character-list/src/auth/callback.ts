import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "../util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {getOAuthClient, getSessionKey, REDIRECT_URL} from "./lib";
import {CallbackParamsType, generators} from "openid-client";
import * as jose from 'jose'

const lambdaHandler = async function (request: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const client = await getOAuthClient();
    const state = request.cookies?.filter(cookie => cookie.startsWith('state')).map(cookie => cookie.split('=')[1]);

    if(state?.length !== 1) return {
        statusCode: 400,
        body: 'Invalid state cookie',
    }

    const tokenSet = await client.callback(REDIRECT_URL, request.queryStringParameters as CallbackParamsType, {state: state[0]});

    const secret = await getSessionKey()
    const jwt = await new jose.EncryptJWT({
            battleNet: tokenSet,
        })
        .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
        .setIssuedAt()
        .setIssuer(process.env.BASE_DOMAIN as string)
        .setAudience(process.env.BASE_DOMAIN as string)
        .setExpirationTime(tokenSet.expires_at as number)
        .encrypt(secret);


    return {
        statusCode: 302,
        headers: {
            Location: '/',
        },
        cookies: [
            `session=${jwt}; Secure; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${tokenSet.expires_in}`,
            `state=deleted; Secure; HttpOnly; SameSite=None; Path=/api/auth; Max-Age=0`,
        ],
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
