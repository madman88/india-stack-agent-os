import { createServer } from "node:http";
import { routeRequest } from "./http.mjs";

const port = Number(process.env.PORT ?? 8787);

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const body = req.method === "GET" || req.method === "OPTIONS" ? {} : await readJson(req);
    const result = await routeRequest({
      method: req.method ?? "GET",
      pathname: url.pathname,
      searchParams: url.searchParams,
      body
    });

    return json(res, result.status, result.body);
  } catch (error) {
    return json(res, 500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

server.listen(port, () => {
  console.log(`mock-api listening on http://localhost:${port}`);
});
