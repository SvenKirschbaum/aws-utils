import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {getLatestRaidReport, REPORT_URL_PREFIX} from "./wcl";
import {captureLambdaHandler, Tracer} from "@aws-lambda-powertools/tracer";
import {injectLambdaContext} from "@aws-lambda-powertools/logger";
import {logger, tracer} from "./util";

const lambdaHandler = async function (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const reportId = await getLatestRaidReport();

    if(reportId) {
        return {
            statusCode: 302,
            headers: {
                'Location': REPORT_URL_PREFIX + reportId,
                'Cache-Control': 'public, max-age 300'
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
