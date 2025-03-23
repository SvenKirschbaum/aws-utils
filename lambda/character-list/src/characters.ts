import {APIGatewayProxyEventV2, APIGatewayProxyResultV2} from "aws-lambda";
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import errorLogger from "@middy/error-logger";
import httpErrorHandlerMiddleware from "@middy/http-error-handler";
import {logger, tracer} from "./util";
import {injectLambdaContext} from "@aws-lambda-powertools/logger/middleware";
import {SessionData, sessionMiddleware} from "./auth/middleware";
import httpContentNegotiation from "@middy/http-content-negotiation";
import httpResponseSerializerMiddleware from "@middy/http-response-serializer";
import {captureLambdaHandler} from "@aws-lambda-powertools/tracer/middleware";
import {getRaiderIOApiKey} from "./lib";
import {originMiddleware} from "./origin-middleware";

const REGIONS = ["eu", "us", "kr", "tw"];
const MAX_LEVEL = 80;
const RELEVANT_EXPANSION = 514;

const fetchForEach = async (characters: any[], type: string, fetchFunction: (character: any) => Promise<any>) => {
    const responses = await Promise.allSettled(characters.map(c => fetchFunction(c)));

    responses.filter(res => res.status === "rejected").forEach((rejection) => {
        logger.error(`Partial failure when fetching ${type} data`, rejection.reason as Error);
    });

    return responses.filter(res => res.status === "fulfilled").reduce((acc, character) => ({...acc, ...character.value}), {});
}

const fetchCharacterRaids = async (character: any, region: string, battleNetToken: string)  => {
    const raidResponse = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${character.realm.slug}/${character.name.toLowerCase()}/encounters/raids?namespace=profile-${region}&locale=en_US`, {
        headers: {
            Authorization: `Bearer ${battleNetToken}`,
        }
    });

    if(!raidResponse.ok) {
        logger.error(`Unexpected response status when fetching raid info for ${character.name}-${character.realm.slug}`, {
            status: raidResponse.status,
            text: await raidResponse.text(),
        });
        throw new Error(`Failed to fetch raid info for ${character.name}-${character.realm.slug}`);
    }

    const raidResponseData = await raidResponse.json();

    return (
        (raidResponseData.expansions || [])
            .filter((expansion: any) => expansion.expansion.id === RELEVANT_EXPANSION)
            .map((expansion: any) => ({[`${character.name.toLowerCase()}-${character.realm.slug}`]: expansion.instances}))
            .shift()
    )
}

const fetchCharacterProfile = async (character: any, region: string, battleNetToken: string) => {
    const profileResponse = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${character.realm.slug}/${character.name.toLowerCase()}?namespace=profile-${region}&locale=en_US`, {
        headers: {
            Authorization: `Bearer ${battleNetToken}`,
        }
    });

    if(!profileResponse.ok) {
        logger.error(`Unexpected response status when fetching profile info for ${character.name}-${character.realm.slug}`, {
            status: profileResponse.status,
            text: await profileResponse.text(),
        });
        throw new Error(`Failed to fetch profile info for ${character.name}-${character.realm.slug}`);
    }

    const profileResponseData = await profileResponse.json();

    return {[`${character.name.toLowerCase()}-${character.realm.slug}`]: profileResponseData};
}

const fetchCharacterMythicKeystoneProfile = async (character: any, region: string, battleNetToken: string) => {
    const mythicKeystoneProfileResponse = await fetch(`https://${region}.api.blizzard.com/profile/wow/character/${character.realm.slug}/${character.name.toLowerCase()}/mythic-keystone-profile?namespace=profile-${region}&locale=en_US`, {
        headers: {
            Authorization: `Bearer ${battleNetToken}`,
        }
    });

    if(!mythicKeystoneProfileResponse.ok) {
        logger.error(`Unexpected response status when fetching mythic keystone profile info for ${character.name}-${character.realm.slug}`, {
            status: mythicKeystoneProfileResponse.status,
            text: await mythicKeystoneProfileResponse.text(),
        });
        throw new Error(`Failed to fetch mythic keystone profile profile info for ${character.name}-${character.realm.slug}`);
    }

    const mythicKeystoneProfileResponseData = await mythicKeystoneProfileResponse.json();

    return {[`${character.name.toLowerCase()}-${character.realm.slug}`]: mythicKeystoneProfileResponseData};
}

const fetchCharacterRaiderIOProfile = async (character: any, region: string) => {
    const rioCredentials = await getRaiderIOApiKey();
    const rioResponse = await fetch(`https://raider.io/api/v1/characters/profile?region=${region}&realm=${character.realm.slug}&name=${character.name.toLowerCase()}&fields=mythic_plus_weekly_highest_level_runs`, {
        headers: {
            Authorization: `Bearer ${rioCredentials.api_key}`,
        }
    });

    if(!rioResponse.ok) {
        logger.error(`Unexpected response status when fetching RIO info for ${character.name}-${character.realm.slug}`, {
            status: rioResponse.status,
            text: await rioResponse.text(),
        });
        throw new Error(`Failed to fetch profile info for ${character.name}-${character.realm.slug}`);
    }

    const rioResponseData = await rioResponse.json();

    return {[`${character.name.toLowerCase()}-${character.realm.slug}`]: rioResponseData};
}


const lambdaHandler = async (request: APIGatewayProxyEventV2 & SessionData): Promise<APIGatewayProxyResultV2> => {
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

    await getRaiderIOApiKey(); //Ensure credentials are prefetched
    const raidsPromise = fetchForEach(maxLevelCharacters, 'raids', (character) => fetchCharacterRaids(character, region, request.session.battleNet.access_token));
    const profilePromise = fetchForEach(maxLevelCharacters, 'character profile', (character) => fetchCharacterProfile(character, region, request.session.battleNet.access_token));
    const mythicKeystonePromise = fetchForEach(maxLevelCharacters, 'mythic keystone profile', (character) => fetchCharacterMythicKeystoneProfile(character, region, request.session.battleNet.access_token));
    const rioPromise = fetchForEach(maxLevelCharacters, 'RIO profile', (character) => fetchCharacterRaiderIOProfile(character, region));

    //Wait for all promises to resolve
    await Promise.allSettled([
        raidsPromise,
        profilePromise,
        mythicKeystonePromise,
        rioPromise
    ]);

    return {
        statusCode: 200,
        headers: {
            "Cache-Control": "max-age=300, s-maxage=3600",
        },
        body: {
            profile: profileData,
            raids: await raidsPromise,
            characterProfile: await profilePromise,
            mythicKeystoneProfile: await mythicKeystonePromise,
            raiderIOProfile: await rioPromise,
        } as any,
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
    .use(sessionMiddleware())
