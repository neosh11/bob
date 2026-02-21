import { resolveApiBaseUrl } from "./runtimeUrls";

const API_BASE_URL = resolveApiBaseUrl();

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);

  const rawBody = init.body;
  let body: BodyInit | undefined;

  if (rawBody === undefined || rawBody === null) {
    body = undefined;
  } else if (
    typeof rawBody === "string" ||
    rawBody instanceof Blob ||
    rawBody instanceof FormData ||
    rawBody instanceof URLSearchParams
  ) {
    body = rawBody;
  } else {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(rawBody);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    credentials: "include",
    headers,
    body
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : "Request failed";
    const issues = typeof data === "object" && data && "issues" in data ? (data as { issues: unknown }).issues : undefined;
    throw new ApiError(response.status, message, issues);
  }

  return data as T;
}
