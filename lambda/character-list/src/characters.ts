import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "./util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {SessionData, sessionMiddleware} from "./auth/middleware";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";

const REGIONS = ["eu", "us", "kr", "tw"];

const lambdaHandler = async function (request: APIGatewayProxyEventV2 & SessionData): Promise<APIGatewayProxyResultV2> {
    const region = request.pathParameters?.region;

    if(!region || !REGIONS.includes(region)) return {
        statusCode: 400,
        body: 'Invalid region',
    }

    const response = await fetch(`https://${region}.api.blizzard.com/profile/user/wow?namespace=profile-${region}&locale=en_US`,{
        headers: {
            Authorization: `Bearer ${request.session.battleNet.access_token}`,
        }
    });

    //No characters in this region
    if(response.status === 404) return {
        statusCode: 200,
        body: {
            wow_accounts: []
        } as any
    }

    if(response.status === 401) return {
        statusCode: 401,
    }

    if(!response.ok) return {
        statusCode: 500,
    }

    const data = await response.json();

    return {
        statusCode: 200,
        headers: {
            "Cache-Control": "max-age=300, s-maxage=3600",
        },
        body: data,
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
    .use(httpContentNegotiation())
    .use(
        httpResponseSerializerMiddleware({
            serializers: [
                {
                    regex: /^application\/json$/,
                    serializer: ({ body }) => JSON.stringify(body)
                }
            ],
            defaultContentType: 'application/json'
        })
    )
    .use(sessionMiddleware())
