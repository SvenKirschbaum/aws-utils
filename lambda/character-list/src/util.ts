import {Tracer} from "@aws-lambda-powertools/tracer";
import {Logger} from "@aws-lambda-powertools/logger";

export const tracer = new Tracer();
export const logger = new Logger();
