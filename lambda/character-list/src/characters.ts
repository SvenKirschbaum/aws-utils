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
const MAX_LEVEL = 70;
const RELEVANT_EXPANSION = 503;

const lambdaHandler = async function (request: APIGatewayProxyEventV2 & SessionData): Promise<APIGatewayProxyResultV2> {
    const region = request.pathParameters?.region;

    if(!region || !REGIONS.includes(region)) return {
        statusCode: 400,
        body: 'Invalid region',
    }

    const profileResponse = await fetch(`https://${region}.api.blizzard.com/profile/user/wow?namespace=profile-${region}&locale=en_US`,{
        headers: {
            Authorization: `Bearer ${request.session.battleNet.access_token}`,
        }
    });

    //No characters in this region
    if(profileResponse.status === 404) return {
        statusCode: 200,
        body: {
            profile: {
                wow_accounts: []
            }
        } as any
    }

    if(profileResponse.status === 401) return {
        statusCode: 401,
    }

    if(!profileResponse.ok) return {
        statusCode: 500,
    }

    const profileData = await profileResponse.json();

    const maxLevelCharacters = profileData.wow_accounts.map((account: any) =>
        account.characters.filter((character: any) => character.level === MAX_LEVEL)
    ).flat();

    let charactersRaidInfo = {};
    try {
        const characterRaidsResponses = await Promise.allSettled(
            maxLevelCharacters.map(async (character: any) => {
                const raidResponse = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${character.realm.slug}/${character.name.toLowerCase()}/encounters/raids?namespace=profile-${region}&locale=en_US`, {
                    headers: {
                        Authorization: `Bearer ${request.session.battleNet.access_token}`,
                    }
                });

                if(!raidResponse.ok) {
                    logger.error(`Unexpected response status when fetching raid info for ${character.name}-${character.realm.slug}`, {
                        status: raidResponse.status,
                        text: await raidResponse.text(),
                    });
                    throw new Error("Failed to fetch raid info for ${character.name}-${character.realm.slug}");
                }

                const raidResponseData = await raidResponse.json();

                return (
                    (raidResponseData.expansions || [])
                        .filter((expansion: any) => expansion.expansion.id === RELEVANT_EXPANSION)
                        .map((expansion: any) => ({[`${character.name.toLowerCase()}-${character.realm.slug}`]: expansion.instances}))
                        .shift()
                )
            })
        );

        characterRaidsResponses.filter(res => res.status === "rejected").forEach((rejection) => {
            logger.error("Partial failure when fetching raid info", rejection.reason as Error);
        });

        charactersRaidInfo = characterRaidsResponses.filter(res => res.status === "fulfilled").reduce((acc, character) => ({...acc, ...character.value}), {});
    } catch (error) {
        logger.error("Failed to fetch raid info", error as Error);
    }

    return {
        statusCode: 200,
        headers: {
            "Cache-Control": "max-age=300, s-maxage=3600",
        },
        body: {
            profile: profileData,
            raids: charactersRaidInfo,
        } as any,
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
