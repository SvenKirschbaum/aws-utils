import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {getLatestMythPlusReport, getLatestRaidReport, REPORT_URL_PREFIX} from "./wcl";

const lambdaHandler = async function (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const reportId = await getLatestMythPlusReport();

    if(reportId) {
        return {
            statusCode: 302,
            headers: {
                'Location': REPORT_URL_PREFIX + reportId
            }
        }
    } else {
        return {
            statusCode: 404,
        }
    }
}

export const handler = middy(lambdaHandler)
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())