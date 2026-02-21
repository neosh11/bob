const DEFAULT_SERVER_PORT = "4000";

function resolveServerOrigin(): string {
  const { protocol, hostname } = window.location;
  const port = import.meta.env.VITE_SERVER_PORT ?? DEFAULT_SERVER_PORT;
  return `${protocol}//${hostname}:${port}`;
}

export function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_URL as string | undefined;
  if (explicit && explicit.trim()) {
    return explicit.replace(/\/+$/u, "");
  }

  return `${resolveServerOrigin()}/api`;
}

export function resolveSocketUrl(): string {
  const explicit = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (explicit && explicit.trim()) {
    return explicit.replace(/\/+$/u, "");
  }

  return resolveServerOrigin();
}
