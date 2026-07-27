const defaultConfig = {
  baseUrl: process.env.MOCK_RAILS_BASE_URL,
  timeoutMs: Number(process.env.RAIL_ADAPTER_TIMEOUT_MS ?? 1500),
  retries: Number(process.env.RAIL_ADAPTER_RETRIES ?? 1)
};

export class RailAdapterError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "RailAdapterError";
    this.details = details;
  }
}

export function railBaseUrl() {
  return defaultConfig.baseUrl;
}

export async function fetchRailJson(path, options = {}, config = defaultConfig) {
  if (!config.baseUrl) {
    throw new RailAdapterError("Rail adapter base URL is not configured", {
      rail: options.rail ?? "unknown",
      path,
      retryable: false
    });
  }

  const url = new URL(path, config.baseUrl);
  const attempts = Math.max(0, config.retries) + 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...(options.headers ?? {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new RailAdapterError(`Rail adapter returned ${response.status}`, {
          rail: options.rail ?? "unknown",
          path,
          status: response.status,
          retryable: response.status >= 500
        });
      }

      return response.json();
    } catch (error) {
      lastError = normalizeRailError(error, { rail: options.rail ?? "unknown", path });
      if (!lastError.details.retryable || attempt === attempts) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function normalizeRailError(error, context) {
  if (error instanceof RailAdapterError) {
    return error;
  }

  const aborted = error instanceof Error && error.name === "AbortError";
  return new RailAdapterError(aborted ? "Rail adapter timed out" : "Rail adapter request failed", {
    ...context,
    retryable: true,
    cause: error instanceof Error ? error.message : "Unknown error"
  });
}
