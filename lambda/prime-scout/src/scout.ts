import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {Tracer} from "@aws-lambda-powertools/tracer";
import {Logger} from "@aws-lambda-powertools/logger";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpJsonBodyParserMiddleware from '@middy/http-json-body-parser'
import httpResponseSerializerMiddleware from '@middy/http-response-serializer'
import {DateTime} from "luxon";
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom'

const tracer = new Tracer();
const logger = new Logger();

const teamRegex = /^https:\/\/www\.primeleague\.gg\/leagues\/teams\/\d+-.+$/;
const matchRegex = /^https:\/\/www\.primeleague\.gg\/leagues\/matches\/(\d+)-.+$/;

const playerBlacklist = ["Kill Like A Sir#WWE", "ĐamnTaco#303", "Brand#WWE", "Greedy Hero#WWE", "Joghurt#EUW"];


const lambdaHandler = async function (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const {url} = event.body as any;

    let match;

    if(teamRegex.exec(url) != null) {
        logger.info("Fetching URL:", url);

        const dom = await JSDOM.fromURL(url);
        const document = dom.window.document;
        const nameNodes = document.querySelectorAll('span[title*="LoL Summoner Name"]');
        const nameList = Array.from(nameNodes).map((element) => element.textContent);

        logger.info("Found Names: " + nameList);


        return {
            statusCode: 200,
            headers: {
                'Expires': DateTime.now().plus({minute: 30}).toHTTP() as string
            },
            body: {
                searchURL: "https://www.op.gg/multisearch/euw?summoners=" + encodeURIComponent(nameList.join(','))
            } as any
        }
    } else if ((match = matchRegex.exec(url)) !== null) {

        const formData = new FormData();

        logger.info("Extracted Match ID:", match[1])

        formData.append('id', match[1]);
        formData.append('action', "init");
        formData.append('devmode', "1");
        formData.append('language', "de");

        logger.info("Fetching Match Data " + formData)

        const data = await fetch('https://www.primeleague.gg/ajax/leagues_match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: (new URLSearchParams(formData as any)).toString()
        }).then(response => response.json()).catch(
            (error) => {
                logger.error("Error fetching match data", error);
                return null;
            }
        ) as any;

        logger.info(data);

        const nameList: string[] = [];

        for (const i in data.lineups) {
            const lineup = data.lineups[i];
            const teamAccounts = [];
            let blacklisted = false;

            for (const j in lineup) {
                const player = lineup[j] as any;
                const gameAccount = player.gameaccounts[0] as string;

                if(playerBlacklist.includes(gameAccount)) {
                    logger.info("Skipping Blacklisted Player:", gameAccount);
                    blacklisted = true;
                }

                teamAccounts.push(gameAccount);
            }

            if(!blacklisted) {
                nameList.push(...teamAccounts);
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Expires': DateTime.now().plus({minute: 30}).toHTTP() as string
            },
            body: {
                searchURL: "https://www.op.gg/multisearch/euw?summoners=" + encodeURIComponent(nameList.join(','))
            } as any
        }
    } else {
        return {
            statusCode: 400,
            body: {
                error: "URL format is unknown. Please provide a PrimeLeague.gg Team or Match URL."
            } as any
        }
    }


}

export const handler = middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(httpErrorHandlerMiddleware())
    .use(errorLogger())
    .use(httpHeaderNormalizer())
    .use(httpContentNegotiation())
    .use(httpJsonBodyParserMiddleware())
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
