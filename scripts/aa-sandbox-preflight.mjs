const provider = process.env.AA_SANDBOX_PROVIDER ?? "setu";

const providers = {
  finvu: {
    required: ["AA_BASE_URL", "AA_CLIENT_API_KEY", "AA_JWS_PRIVATE_KEY"],
    optional: ["AA_JWS_KEY_ID", "AA_CALLBACK_BASE_URL"],
    docs: "https://finvu.github.io/sandbox/"
  },
  setu: {
    required: ["AA_BASE_URL", "AA_ACCESS_TOKEN", "AA_PRODUCT_INSTANCE_ID"],
    optional: ["AA_CALLBACK_BASE_URL"],
    docs: "https://docs.setu.co/data/account-aggregator/api-integration/consent-flow"
  }
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const config = providers[provider];
assert(config, `Unsupported AA_SANDBOX_PROVIDER=${provider}. Expected one of: ${Object.keys(providers).join(", ")}`);

const missing = config.required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.log(
    JSON.stringify(
      {
        status: "missing_credentials",
        provider,
        missing,
        optional: config.optional,
        docs: config.docs
      },
      null,
      2
    )
  );
  process.exit(0);
}

const healthUrl = new URL("/", process.env.AA_BASE_URL);
const response = await fetch(healthUrl, {
  method: "GET",
  headers: providerHeaders(provider)
});

console.log(
  JSON.stringify(
    {
      status: response.ok ? "reachable" : "reachable_with_non_2xx",
      provider,
      baseUrl: process.env.AA_BASE_URL,
      httpStatus: response.status
    },
    null,
    2
  )
);

function providerHeaders(name) {
  if (name === "setu") {
    return {
      authorization: `Bearer ${process.env.AA_ACCESS_TOKEN}`,
      "x-product-instance-id": process.env.AA_PRODUCT_INSTANCE_ID
    };
  }

  return {
    client_api_key: process.env.AA_CLIENT_API_KEY,
    "x-jws-signature": "preflight"
  };
}
