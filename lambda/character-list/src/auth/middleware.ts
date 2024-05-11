import { createError } from '@middy/util'
import {getSessionKey} from "./lib";
import * as jose from "jose";
import {TokenSet} from "openid-client";

export interface SessionData {
    session: SessionPayload,
}

export interface SessionPayload {
    battleNet: TokenSet,
}

export const sessionMiddleware = (opts = {}) => {
    return {
        before: async (request: any) => {
            const token = request.event.cookies?.filter((cookie: string) => cookie.startsWith('session')).map((cookie: string) => cookie.split('=')[1]);

            if(token?.length !== 1) {
                throw createError(401, 'No session cookie');
            }

            const secret = await getSessionKey()

            const { payload} = await jose.jwtDecrypt(token[0] as string, secret, {
                issuer: process.env.BASE_DOMAIN as string,
                audience: process.env.BASE_DOMAIN as string,
            });

            request.event.session = payload as any as SessionPayload;
        },
        after: async (response: any) => {

        },
        onError: async (error: any) => {

        }
    }
}