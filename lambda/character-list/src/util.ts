import {Tracer} from "@aws-lambda-powertools/tracer";
import {Logger} from "@aws-lambda-powertools/logger";

export const tracer = new Tracer({ serviceName: 'character-list' });
export const logger = new Logger({ serviceName: 'character-list' });
