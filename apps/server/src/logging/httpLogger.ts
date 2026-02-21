import { pinoHttp } from "pino-http";
import type { IncomingMessage } from "node:http";
import type { Logger } from "pino";

export function createHttpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    serializers: {
      req(request: IncomingMessage) {
        return {
          method: request.method,
          url: request.url,
          remoteAddress: request.socket?.remoteAddress
        };
      }
    }
  });
}
