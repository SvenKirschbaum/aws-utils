import { createError } from '@middy/util'
import {parseSession, SessionPayload} from "./lib";

export interface SessionData {
    session: SessionPayload,
}

export const sessionMiddleware = (opts = {}) => {
    return {
        before: async (request: any) => {
            const token = request.event.cookies?.filter((cookie: string) => cookie.startsWith('session')).map((cookie: string) => cookie.split('=')[1]);

            if(token?.length !== 1) {
                throw createError(401, 'No session cookie');
            }

            try {
                request.event.session = await parseSession(token[0]);
            } catch (e) {
                console.log("Error decrypting token", e);
                throw createError(401, 'Invalid session');
            }
        },
        after: async (response: any) => {

        },
        onError: async (error: any) => {

        }
    }
}