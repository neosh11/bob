import type { AppConfig } from "../config/env.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isIpv4Address(value: string): boolean {
  const octets = value.split(".");
  if (octets.length !== 4) {
    return false;
  }

  return octets.every((octet) => {
    if (!/^\d{1,3}$/u.test(octet)) {
      return false;
    }

    const num = Number(octet);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
}

function isIpv4Prefix(value: string): boolean {
  const octets = value.split(".");
  if (octets.length < 1 || octets.length > 4) {
    return false;
  }

  return octets.every((octet) => {
    if (!/^\d{1,3}$/u.test(octet)) {
      return false;
    }

    const num = Number(octet);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
}

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
    const hostname = requested.hostname.toLowerCase();

    return config.webOriginHostPrefixes.some((prefixRaw) => {
      const prefix = prefixRaw.toLowerCase();
      if (isIpv4Prefix(prefix)) {
        if (!isIpv4Address(hostname)) {
          return false;
        }
        if (prefix.split(".").length === 4) {
          return hostname === prefix;
        }
        return hostname === prefix || hostname.startsWith(`${prefix}.`);
      }

      return hostname.startsWith(prefix);
    });
  }

  let configured: URL;
  try {
    configured = new URL(config.webOrigin);
  } catch {
    return false;
  }

  return requested.origin === configured.origin;
}
