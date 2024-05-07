import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "./util";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {jwtDecode} from "jwt-decode";
import {getSecret, updateUserAccessToken} from "./secret";

const WCL_AUTHORIZATION_URL = 'https://www.warcraftlogs.com/oauth/authorize';
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';

const lambdaHandler = async function (request: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    //If code not in query string
    if (!request.queryStringParameters || !request.queryStringParameters.code) {
        const url = new URL(WCL_AUTHORIZATION_URL);
        //Set query params
        url.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID as string);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('state', 'abcd1234');

        return {
            statusCode: 302,
            headers: {
                'Location': url.toString()
            }
        }
    } else {
        const secret = await getSecret();

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', request.queryStringParameters.code);

        const response = await fetch(WCL_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.OAUTH_CLIENT_ID}:${secret.client_secret}`).toString('base64')}`,
            },
            body: params,
        });

        if (!response.ok) throw new Error('Failed to get token');

        const data = await response.json() as {access_token: string, token_type: string, expires_in: number, refresh_token: string};

        const parsedNewToken = jwtDecode(data.access_token) as {sub: string};
        const newUserId = parseInt(parsedNewToken.sub);

        if(secret.user_access_token) {
            const parsedExistingToken = jwtDecode(secret.user_access_token) as {sub: string};
            const existingUserId = parseInt(parsedExistingToken.sub);

            if(existingUserId !== newUserId) throw new Error('User ID mismatch');
        }

        await updateUserAccessToken(data.access_token);

        return {
            statusCode: 200,
            body: 'Token updated'
        }
    }
}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
