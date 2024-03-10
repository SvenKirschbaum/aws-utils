import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {getLatestMythPlusReport, REPORT_URL_PREFIX, reportsAge} from "./wcl";
import {logger, tracer} from "./util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";

const lambdaHandler = async function (_: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const reportId = await getLatestMythPlusReport();

    if(reportId) {
        return {
            statusCode: 302,
            headers: {
                'Location': REPORT_URL_PREFIX + reportId,
                'Expires': reportsAge.plus({minute: 5}).toHTTP() as string
            }
        }
    } else {
        return {
            statusCode: 404,
        }
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
