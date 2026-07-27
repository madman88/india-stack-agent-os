const defaultConfig = {
  mode: process.env.RAIL_ADAPTER_MODE ?? (process.env.MOCK_RAILS_BASE_URL ? "mock-http" : "in-process"),
  timeoutMs: Number(process.env.RAIL_ADAPTER_TIMEOUT_MS ?? 1500),
  retries: Number(process.env.RAIL_ADAPTER_RETRIES ?? 1)
};

const railBaseUrlEnv = {
  AA: "AA_BASE_URL",
  GSTN: "GSTN_BASE_URL",
  ONDC: "ONDC_BASE_URL",
  OCEN: "OCEN_BASE_URL",
  UPI: "UPI_BASE_URL",
  Finternet: "FINTERNET_BASE_URL"
};

export class RailAdapterError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "RailAdapterError";
    this.details = details;
  }
}

export function railBaseUrl() {
  return process.env.MOCK_RAILS_BASE_URL;
}

export function railAdapterMode() {
  return defaultConfig.mode;
}

export function usesRailHttp() {
  return defaultConfig.mode === "mock-http" || defaultConfig.mode === "sandbox" || defaultConfig.mode === "prod";
}

export async function fetchRailJson(path, options = {}, config = defaultConfig) {
  const baseUrl = config.baseUrl ?? railOperationBaseUrl(options.rail, config);

  if (!baseUrl) {
    throw new RailAdapterError("Rail adapter base URL is not configured", {
      rail: options.rail ?? "unknown",
      operation: options.operation,
      path,
      retryable: false
    });
  }

  const url = new URL(path, baseUrl);
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
          operation: options.operation,
          path,
          status: response.status,
          retryable: response.status >= 500
        });
      }

      return response.json();
    } catch (error) {
      lastError = normalizeRailError(error, { rail: options.rail ?? "unknown", operation: options.operation, path });
      if (!lastError.details.retryable || attempt === attempts) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function railOperationBaseUrl(rail, config) {
  if (config.mode === "mock-http") {
    return process.env.MOCK_RAILS_BASE_URL;
  }

  if (config.mode === "sandbox" || config.mode === "prod") {
    return process.env[railBaseUrlEnv[rail] ?? ""];
  }

  return process.env.MOCK_RAILS_BASE_URL;
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

export function normalizeRailErrorShape(error, fallback = {}) {
  const details = error instanceof RailAdapterError ? error.details : {};
  return {
    rail: details.rail ?? fallback.rail ?? "unknown",
    operation: details.operation ?? fallback.operation ?? details.path ?? "unknown",
    retryable: Boolean(details.retryable),
    status: details.status ?? "failed",
    message: error instanceof Error ? error.message : String(error),
    correlationId: details.correlationId ?? fallback.correlationId ?? null
  };
}
