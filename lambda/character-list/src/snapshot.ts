import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "./lib/util";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {SessionData, sessionMiddleware} from "./lib/auth-middleware";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {originMiddleware} from "./lib/origin-middleware";
import {AttributeValue, DynamoDBClient, GetItemCommand} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {decryptShareToken, RosterShareTokenData} from "./lib/share";

const ddb = tracer.captureAWSv3Client(new DynamoDBClient())

const lambdaHandler = async (request: APIGatewayProxyEventV2 & SessionData): Promise<APIGatewayProxyResultV2> => {
    const token = request.pathParameters?.token;

    if(!token) {
        return {
            statusCode: 404,
        }
    }

    let key: RosterShareTokenData;
    try {
        key = await decryptShareToken(token)
    } catch (e) {
        logger.error('Failed to decrypt share token', e as Error)
        return {
            statusCode: 404,
        }
    }

    const r = await ddb.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
            PK: { S: key.PK },
            SK: { S: key.SK }
        },
        ProjectionExpression: '#d',
        ExpressionAttributeNames: {
            '#d': 'DATA'
        }
    }));

    if(!r.Item) {
        return {
            statusCode: 404,
        }
    }

    const data = unmarshall(r.Item.DATA.M as Record<string, AttributeValue>) as any;

    return {
        statusCode: 200,
        headers: {
            "Cache-Control": "max-age=3153600000",
        },
        body: {
            shareToken: token,
            ...data
        },
    }
}


export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(originMiddleware())
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
