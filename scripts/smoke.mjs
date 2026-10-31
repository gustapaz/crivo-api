import assert from "node:assert/strict";
import { examples } from "../server/examples.mjs";
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base))
  throw new Error("Use npm run smoke -- URL");
const get = (path) => fetch(new URL(path, base));
const post = (path, body) =>
  fetch(new URL(path, base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const health = await get("/api/health");
assert.equal(health.status, 200);
assert.equal((await health.json()).storage, "none");
const input = examples.workshops.request;
const response = await post("/api/v1/audit", input);
assert.equal(response.status, 200);
const report = await response.json();
assert.deepEqual(report.summary, {
  total: 6,
  accepted: 3,
  rejected: 3,
  issues: 3,
  formula_cells_escaped: 1,
});
const exported = await post("/api/v1/export", input);
assert.equal(exported.status, 200);
assert.equal(await exported.text(), report.clean_csv);
assert.equal(exported.headers.get("x-crivo-accepted"), "3");
assert.match(report.clean_csv, /'=1\+1/);
const bad = await post("/api/v1/audit", { ...input, csv: "wrong\na" });
assert.equal(bad.status, 422);
assert.equal((await bad.json()).code, "header_mismatch");
const parallel = await Promise.all(
  Array.from({ length: 4 }, () =>
    post("/api/v1/audit", examples.library.request).then((r) => r.json()),
  ),
);
assert.ok(parallel.every((r) => r.summary.accepted === 2));
const spec = await (await get("/api/openapi.json")).json();
assert.equal(spec.info.title, "Crivo API");
console.log(
  JSON.stringify(
    {
      ok: true,
      base: new URL(base).origin,
      checks: [
        "health",
        "real audit",
        "rejections",
        "formula escaping",
        "CSV export",
        "invalid headers",
        "parallel isolation",
        "OpenAPI",
      ],
    },
    null,
    2,
  ),
);
