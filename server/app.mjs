import { IttyRouter } from "itty-router";
import { audit, InputError, limits } from "./engine.mjs";
import { examples } from "./examples.mjs";
import { openapi } from "./openapi.mjs";
const router = IttyRouter();
const json = (value) => Response.json(value);
router.get("/api/health", () =>
  json({
    status: "ok",
    service: "crivo-api",
    version: "1.0.0",
    storage: "none",
  }),
);
router.get("/api/v1/examples", () =>
  json({ items: Object.entries(examples).map(([id, e]) => ({ id, ...e })) }),
);
router.get("/api/openapi.json", () => json(openapi));
async function read(request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new InputError(
      "unsupported_media_type",
      "Use application/json.",
      415,
    );
  if (
    request.headers.has("content-encoding") &&
    request.headers.get("content-encoding") !== "identity"
  )
    throw new InputError(
      "unsupported_encoding",
      "Corpo comprimido não é aceito.",
      415,
    );
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limits.body_bytes)
    throw new InputError("body_too_large", "Limite de 64 KiB.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new InputError("invalid_json", "Envie um objeto JSON.", 400);
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limits.body_bytes) {
        await reader.cancel();
        throw new InputError("body_too_large", "Limite de 64 KiB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InputError("invalid_json", "JSON ou UTF-8 inválido.", 400);
  }
}
router.post("/api/v1/audit", async (request) =>
  json(audit(await read(request))),
);
router.post("/api/v1/export", async (request) => {
  const report = audit(await read(request));
  return new Response(report.clean_csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="crivo-clean.csv"',
      "X-Crivo-Accepted": String(report.summary.accepted),
      "X-Crivo-Rejected": String(report.summary.rejected),
      "X-Crivo-Formula-Escapes": String(report.summary.formula_cells_escaped),
    },
  });
});
router.all("*", (request) => {
  throw new InputError("not_found", "Endpoint não encontrado.", 404);
});
export async function handle(request) {
  const requestId = crypto.randomUUID();
  let response;
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new InputError(
        "origin_denied",
        "Origem de navegador não autorizada.",
        403,
      );
    response = await router.fetch(request);
  } catch (error) {
    const known = error instanceof InputError;
    const status = known ? error.status : 500,
      code = known ? error.code : "internal_error";
    response = new Response(
      JSON.stringify({
        type: "urn:crivo:error:" + code,
        title: known
          ? error.message
          : "Não foi possível processar a requisição.",
        status,
        code,
        request_id: requestId,
      }),
      { status, headers: { "Content-Type": "application/problem+json" } },
    );
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Request-Id", requestId);
  return new Response(response.body, { status: response.status, headers });
}
