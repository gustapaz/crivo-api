import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { handle } from "../server/app.mjs";
import { examples } from "../server/examples.mjs";
let server, base;
before(async () => {
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await handle(
      new Request(new URL(req.url, base), {
        method: req.method,
        headers: req.headers,
        ...(["GET", "HEAD"].includes(req.method)
          ? {}
          : { body: Buffer.concat(chunks) }),
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => new Promise((resolve) => server.close(resolve)));
const post = (body, headers = {}) =>
  fetch(base + "/api/v1/audit", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
test("real HTTP audit and export agree", async () => {
  const response = await post(examples.workshops.request);
  assert.equal(response.status, 200);
  const report = await response.json();
  const exported = await fetch(base + "/api/v1/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(examples.workshops.request),
  });
  assert.equal(await exported.text(), report.clean_csv);
  assert.equal(exported.headers.get("x-crivo-accepted"), "3");
  assert.match(exported.headers.get("content-disposition"), /attachment/);
});
test("health and examples public with no authentication", async () => {
  assert.equal(
    (await (await fetch(base + "/api/health")).json()).storage,
    "none",
  );
  assert.equal(
    (await (await fetch(base + "/api/v1/examples")).json()).items.length,
    2,
  );
});
test("OpenAPI declares every business route", async () => {
  const spec = await (await fetch(base + "/api/openapi.json")).json();
  assert.equal(spec.openapi, "3.0.3");
  assert.ok(spec.paths["/api/v1/audit"].post);
  assert.ok(spec.paths["/api/v1/export"].post);
});
test("broken JSON, wrong content type, unknown endpoint and cross origin", async () => {
  for (const [response, status] of [
    [await post("{"), 400],
    [await post({}, { "content-type": "text/plain" }), 415],
    [await fetch(base + "/missing"), 404],
    [
      await post(examples.workshops.request, {
        origin: "https://elsewhere.example",
      }),
      403,
    ],
  ]) {
    assert.equal(response.status, status);
    assert.match(response.headers.get("content-type"), /problem\+json/);
    const problem = await response.json();
    assert.equal(problem.status, status);
    assert.ok(problem.request_id);
    assert.equal(response.headers.get("x-request-id"), problem.request_id);
  }
});
test("actual streamed body limit without relying on content length", async () => {
  const req = new Request("https://crivo.test/api/v1/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: " ".repeat(65537),
  });
  const r = await handle(req);
  assert.equal(r.status, 413);
  assert.equal((await r.json()).code, "body_too_large");
});
test("UTF8 byte size, not just character count", async () => {
  const r = await post({
    csv: "value\n" + "é".repeat(33000),
    columns: [{ name: "value", type: "text" }],
  });
  assert.equal(r.status, 413);
});
test("compressed body rejected", async () =>
  assert.equal((await post("{}", { "content-encoding": "gzip" })).status, 415));
test("same origin allowed and cache/security headers present", async () => {
  const r = await post(examples.library.request, { origin: base });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});
test("parallel audits do not share deduplication state", async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      post(examples.workshops.request).then((r) => r.json()),
    ),
  );
  assert.ok(results.every((r) => r.summary.accepted === 3));
});
