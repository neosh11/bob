import type { AppConfig } from "../config/env.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function isCorsOriginAllowed(origin: string | undefined, config: AppConfig): boolean {
  if (!origin) {
    return true;
  }

  let requested: URL;
  try {
    requested = new URL(origin);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(requested.protocol)) {
    return false;
  }

  if (config.webOriginHostPrefixes.length > 0) {
    return config.webOriginHostPrefixes.some((prefix) => requested.hostname.startsWith(prefix));
  }

  let configured: URL;
  try {
    configured = new URL(config.webOrigin);
  } catch {
    return false;
  }

  return requested.origin === configured.origin;
}
