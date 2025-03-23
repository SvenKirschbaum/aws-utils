import { createError } from '@middy/util'
import {timingSafeEqual} from "node:crypto";
import {getOriginSecret} from "./lib";


export const originMiddleware = (opts = {}) => {
    return {
        before: async (request: any) => {
            const value = request.event.headers?.['x-origin-secret'] as string | undefined;

            if(value == undefined) {
                throw createError(401, 'Unauthorized');
            }

            const encoder = new TextEncoder();

            const encodedValue = encoder.encode(value);
            const encodedSecret = encoder.encode(await getOriginSecret());

            if (encodedValue.byteLength !== encodedSecret.byteLength) {
                throw createError(401, 'Unauthorized');
            }

            if (!timingSafeEqual(encodedValue, encodedSecret)) {
                throw createError(401, 'Unauthorized');
            }
        },
        after: async (response: any) => {

        },
        onError: async (error: any) => {

        }
    }
}