import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "../util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {startOAuthAuthorization} from "./lib";


const lambdaHandler = async function (_: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const authData = await startOAuthAuthorization();

    return {
        statusCode: 302,
        headers: {
            Location: authData.clientRedirectURL.toString(),
        },
        cookies: [
            `authContext=${authData.clientContext}; Secure; HttpOnly; SameSite=None; Path=/api/auth; Max-Age=3600`,
        ],
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
