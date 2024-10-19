import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "../util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {finishOAuthAuthorization} from "./lib";

const lambdaHandler = async function (request: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const clientContext = request.cookies?.filter(cookie => cookie.startsWith('authContext')).map(cookie => cookie.split('=')[1]);

    if(clientContext?.length !== 1) return {
        statusCode: 400,
        body: 'Invalid authContext cookie',
    }

    const oAuthSessionData = await finishOAuthAuthorization(request.rawQueryString, clientContext[0]);

    return {
        statusCode: 302,
        headers: {
            Location: '/',
        },
        cookies: [
            `session=${oAuthSessionData.clientSession}; Secure; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${oAuthSessionData.expires_in}`,
            `authContext=deleted; Secure; HttpOnly; SameSite=None; Path=/api/auth; Max-Age=0`,
        ],
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
