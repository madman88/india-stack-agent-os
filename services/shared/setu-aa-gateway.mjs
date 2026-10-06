// Portable server-side client for Node and Cloudflare Workers. Never exposes tokens.
export function createSetuGateway(config, fetcher = fetch, clock = Date.now) {
  const baseUrl = config.AA_BASE_URL ?? "https://fiu-sandbox.setu.co";
  let cachedToken;
  let expiresAt = 0;
  let pending;

  async function accessToken() {
    if (!(config.AA_CLIENT_ID && config.AA_CLIENT_SECRET)) {
      if (config.AA_ACCESS_TOKEN) return config.AA_ACCESS_TOKEN;
      throw new Error("Setu sandbox credentials are missing");
    }
    if (cachedToken && clock() < expiresAt) return cachedToken;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher("https://accountservice.setu.co/v1/users/login", {
        method: "POST",
        headers: { "content-type": "application/json", client: "bridge" },
        body: JSON.stringify({ clientID: config.AA_CLIENT_ID, secret: config.AA_CLIENT_SECRET, grant_type: "client_credentials" }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`Setu authentication failed (${response.status})`);
      const body = await response.json();
      if (!body.access_token) throw new Error("Setu authentication returned no access token");
      cachedToken = body.access_token;
      const lifetime = Number(body.expires_in ?? 300);
      expiresAt = clock() + Math.max(0, lifetime - 30) * 1000;
      return cachedToken;
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  async function request(path, options = {}) {
    if (!config.AA_PRODUCT_INSTANCE_ID) throw new Error("Setu product instance is missing");
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken();
      const response = await fetcher(new URL(path, baseUrl), {
        method: options.method ?? "GET",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-product-instance-id": config.AA_PRODUCT_INSTANCE_ID },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(20000)
      });
      // Authentication is checked before execution; replay only once on 401.
      if (response.status === 401 && attempt === 0 && config.AA_CLIENT_ID && config.AA_CLIENT_SECRET) {
        cachedToken = undefined;
        expiresAt = 0;
        continue;
      }
      if (!response.ok) {
        const error = new Error(`Setu request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    }
  }
  return { request };
}
