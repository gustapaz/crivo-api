const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const response = (description, schema, type = "application/json") => ({
  description,
  content: { [type]: { schema } },
});
const errors = Object.fromEntries(
  [400, 403, 404, 413, 415, 422, 500].map((code) => [
    code,
    response(
      "Erro estruturado; request_id permite identificar a requisição.",
      ref("Problem"),
      "application/problem+json",
    ),
  ]),
);
const input = {
  required: true,
  content: { "application/json": { schema: ref("AuditRequest") } },
};
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Crivo API",
    version: "1.0.0",
    description:
      "Auditoria e exportação de CSV no servidor, sem armazenamento. Dados de exemplos são sintéticos. Sem login: todos os endpoints são públicos e limitados a 64 KiB por requisição, 500 registros e 12 colunas. Duplicatas são avaliadas entre registros integralmente válidos; o primeiro vence. Números usam ponto decimal, até 6 casas e módulo máximo 1e9. Datas são YYYY-MM-DD válidas. Registros citados são lógicos, contando cabeçalho como 1. Exportação neutraliza fórmulas textuais com apóstrofo, inclusive prefixadas por espaços.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Operação" }, { name: "Auditoria" }],
  paths: {
    "/api/health": {
      get: {
        tags: ["Operação"],
        operationId: "health",
        summary: "Verificar serviço",
        responses: {
          200: response("Serviço disponível", {
            type: "object",
            required: ["status", "service", "version", "storage"],
            properties: {
              status: { type: "string", enum: ["ok"] },
              service: { type: "string" },
              version: { type: "string" },
              storage: { type: "string", enum: ["none"] },
            },
          }),
          ...errors,
        },
      },
    },
    "/api/v1/examples": {
      get: {
        tags: ["Operação"],
        operationId: "examples",
        summary: "Obter dois exemplos sintéticos e seus contratos",
        responses: {
          200: response("Exemplos executáveis", {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "title", "description", "request"],
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    request: ref("AuditRequest"),
                  },
                },
              },
            },
          }),
          ...errors,
        },
      },
    },
    "/api/v1/audit": {
      post: {
        tags: ["Auditoria"],
        operationId: "audit",
        summary: "Validar CSV e produzir relatório e CSV tratado",
        description:
          "Entrada malformada retorna 422. Problemas em registros retornam 200 com rejected_rows e issues; apenas registros integralmente válidos aparecem em accepted e clean_csv.",
        requestBody: input,
        responses: {
          200: response(
            "Relatório calculado sem guardar o arquivo",
            ref("Report"),
          ),
          ...errors,
        },
      },
    },
    "/api/v1/export": {
      post: {
        tags: ["Auditoria"],
        operationId: "export",
        summary: "Baixar CSV com os registros aceitos",
        description:
          "Reprocessa o mesmo corpo; não usa relatório armazenado. Sempre inclui cabeçalho, mesmo sem registros aceitos. Retorna CRLF e UTF-8, sem BOM. Headers X-Crivo-Accepted, X-Crivo-Rejected e X-Crivo-Formula-Escapes indicam contagens.",
        requestBody: input,
        responses: {
          200: {
            ...response("CSV tratado", { type: "string" }, "text/csv"),
            headers: {
              "X-Crivo-Accepted": { schema: { type: "integer" } },
              "X-Crivo-Rejected": { schema: { type: "integer" } },
              "X-Crivo-Formula-Escapes": { schema: { type: "integer" } },
            },
          },
          ...errors,
        },
      },
    },
  },
  components: {
    schemas: {
      Column: {
        type: "object",
        additionalProperties: false,
        required: ["name", "type"],
        properties: {
          name: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{0,39}$" },
          type: {
            type: "string",
            enum: ["text", "integer", "number", "email", "date", "enum"],
          },
          required: { type: "boolean", default: true },
          unique: { type: "boolean", default: false },
          trim: { type: "boolean", default: true },
          case: {
            type: "string",
            enum: ["lower", "upper"],
            description:
              "Somente text, email e enum; valores enum devem estar na forma normalizada.",
          },
          min: {
            type: "number",
            minimum: -1e9,
            maximum: 1e9,
            description: "Somente tipos numéricos; min <= max.",
          },
          max: { type: "number", minimum: -1e9, maximum: 1e9 },
          values: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            uniqueItems: true,
            items: { type: "string", minLength: 1, maxLength: 100 },
            description: "Obrigatório somente para enum.",
          },
        },
      },
      AuditRequest: {
        type: "object",
        additionalProperties: false,
        required: ["csv", "columns"],
        properties: {
          csv: {
            type: "string",
            minLength: 1,
            description:
              "CSV com cabeçalho exato, células com até 500 caracteres. CRLF, LF e campos entre aspas são aceitos. Linhas vazias são ignoradas. Sem inferência de tipos ou delimitador.",
          },
          delimiter: { type: "string", enum: [",", ";", "\t"], default: "," },
          columns: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: ref("Column"),
          },
        },
      },
      Issue: {
        type: "object",
        required: ["row", "column", "code", "message"],
        properties: {
          row: { type: "integer", minimum: 2 },
          column: { type: "string", nullable: true },
          code: { type: "string" },
          message: { type: "string" },
        },
      },
      Report: {
        type: "object",
        required: [
          "version",
          "summary",
          "columns",
          "accepted",
          "rejected_rows",
          "issues",
          "clean_csv",
          "semantics",
        ],
        properties: {
          version: { type: "string" },
          summary: {
            type: "object",
            required: [
              "total",
              "accepted",
              "rejected",
              "issues",
              "formula_cells_escaped",
            ],
            properties: Object.fromEntries(
              [
                "total",
                "accepted",
                "rejected",
                "issues",
                "formula_cells_escaped",
              ].map((k) => [k, { type: "integer", minimum: 0 }]),
            ),
          },
          columns: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "type"],
              properties: {
                name: { type: "string" },
                type: { type: "string" },
              },
            },
          },
          accepted: {
            type: "array",
            items: {
              type: "object",
              required: ["row", "values"],
              properties: {
                row: { type: "integer" },
                values: {
                  type: "object",
                  additionalProperties: {
                    anyOf: [
                      { type: "string", nullable: true },
                      { type: "number", nullable: true },
                    ],
                  },
                },
              },
            },
          },
          rejected_rows: { type: "array", items: { type: "integer" } },
          issues: { type: "array", items: ref("Issue") },
          clean_csv: { type: "string" },
          semantics: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      },
      Problem: {
        type: "object",
        required: ["type", "title", "status", "code", "request_id"],
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          status: { type: "integer" },
          code: { type: "string" },
          request_id: { type: "string", format: "uuid" },
        },
      },
    },
  },
};
