import pino from "pino";

export function createLogger(nodeEnv: "development" | "test" | "production") {
  return pino({
    level: nodeEnv === "test" ? "silent" : nodeEnv === "development" ? "debug" : "info",
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "res.headers[\"set-cookie\"]"],
      censor: "[REDACTED]"
    }
  });
}
