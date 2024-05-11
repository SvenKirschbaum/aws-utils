import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "../util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {getOAuthClient} from "./lib";
import { generators } from "openid-client";

const lambdaHandler = async function (_: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const client = await getOAuthClient();
    const state = generators.state();
    const authorizationUrl = client.authorizationUrl({
        scope: 'openid wow.profile',
        state,
    });

    return {
        statusCode: 302,
        headers: {
            Location: authorizationUrl,
        },
        cookies: [
            `state=${state}; Secure; HttpOnly; SameSite=None; Path=/api/auth; Max-Age=600`,
        ],
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
