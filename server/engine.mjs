import Papa from "papaparse";

export const limits = Object.freeze({
  body_bytes: 65536,
  rows: 500,
  columns: 12,
  cell_characters: 500,
});
export class InputError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message) => {
  throw new InputError(code, message);
};
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
const allowedTypes = ["text", "integer", "number", "email", "date", "enum"];
function keys(value, allowed, context) {
  if (!plain(value) || Object.keys(value).some((k) => !allowed.includes(k)))
    fail(
      "invalid_schema",
      `Objeto inválido ou propriedade desconhecida em ${context}.`,
    );
}
export function validateInput(input) {
  keys(input, ["csv", "delimiter", "columns"], "requisição");
  if (typeof input.csv !== "string" || !input.csv.trim())
    fail("empty_csv", "Envie um CSV não vazio.");
  if (new TextEncoder().encode(input.csv).byteLength > limits.body_bytes)
    throw new InputError("body_too_large", "CSV excede 64 KiB.", 413);
  if (
    !Array.isArray(input.columns) ||
    !input.columns.length ||
    input.columns.length > limits.columns
  )
    fail("invalid_schema", "Defina entre 1 e 12 colunas.");
  if (
    input.delimiter !== undefined &&
    ![",", ";", "\t"].includes(input.delimiter)
  )
    fail(
      "invalid_delimiter",
      "Delimitador permitido: vírgula, ponto e vírgula ou tab.",
    );
  const names = new Set();
  const columns = input.columns.map((c) => {
    keys(
      c,
      [
        "name",
        "type",
        "required",
        "unique",
        "trim",
        "case",
        "min",
        "max",
        "values",
      ],
      "coluna",
    );
    if (
      typeof c.name !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(c.name) ||
      names.has(c.name)
    )
      fail(
        "invalid_schema",
        "Nomes de coluna devem ser únicos e usar letras ASCII, números e underscore.",
      );
    names.add(c.name);
    if (!allowedTypes.includes(c.type))
      fail("invalid_schema", "Tipo de coluna desconhecido.");
    for (const key of ["required", "unique", "trim"])
      if (c[key] !== undefined && typeof c[key] !== "boolean")
        fail("invalid_schema", `${key} deve ser booleano.`);
    if (
      c.case !== undefined &&
      (!["lower", "upper"].includes(c.case) ||
        !["text", "email", "enum"].includes(c.type))
    )
      fail("invalid_schema", "case exige coluna textual e lower ou upper.");
    if (
      (c.min !== undefined || c.max !== undefined) &&
      !["integer", "number"].includes(c.type)
    )
      fail("invalid_schema", "min/max exigem coluna numérica.");
    for (const key of ["min", "max"])
      if (
        c[key] !== undefined &&
        (!Number.isFinite(c[key]) || Math.abs(c[key]) > 1e9)
      )
        fail(
          "invalid_schema",
          "Limites numéricos devem estar entre -1e9 e 1e9.",
        );
    if (c.min !== undefined && c.max !== undefined && c.min > c.max)
      fail("invalid_schema", "min não pode exceder max.");
    if (c.type === "enum") {
      if (
        !Array.isArray(c.values) ||
        !c.values.length ||
        c.values.length > 20 ||
        c.values.some((v) => typeof v !== "string" || !v || v.length > 100) ||
        new Set(c.values).size !== c.values.length
      )
        fail("invalid_schema", "enum exige 1 a 20 valores textuais únicos.");
    } else if (c.values !== undefined)
      fail("invalid_schema", "values exige enum.");
    return { required: true, unique: false, trim: true, ...c };
  });
  return { csv: input.csv, delimiter: input.delimiter ?? ",", columns };
}
function convert(value, c) {
  let text = c.trim ? value.trim() : value;
  if (c.case === "lower") text = text.toLowerCase();
  if (c.case === "upper") text = text.toUpperCase();
  if (text === "") return c.required ? { error: "required" } : { value: null };
  if (text.length > limits.cell_characters) return { error: "cell_too_long" };
  if (c.type === "integer" || c.type === "number") {
    const pattern =
      c.type === "integer"
        ? /^-?(?:0|[1-9]\d*)$/
        : /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
    if (!pattern.test(text)) return { error: "invalid_" + c.type };
    const number = Number(text);
    if (!Number.isFinite(number) || Math.abs(number) > 1e9)
      return { error: "number_out_of_range" };
    if (
      (c.min !== undefined && number < c.min) ||
      (c.max !== undefined && number > c.max)
    )
      return { error: "outside_bounds" };
    return { value: number };
  }
  if (c.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
    return { error: "invalid_email" };
  if (c.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: "invalid_date" };
    const date = new Date(text + "T00:00:00.000Z");
    if (
      !Number.isFinite(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== text
    )
      return { error: "invalid_date" };
  }
  if (c.type === "enum" && !c.values.includes(text))
    return { error: "invalid_enum" };
  return { value: text };
}
export function audit(raw) {
  const { csv, columns, delimiter } = validateInput(raw);
  // No dynamic typing, header renaming or silent malformed-row recovery.
  const result = Papa.parse(csv.replace(/^\uFEFF/, ""), {
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (result.errors.length)
    fail("malformed_csv", "CSV malformado: confira aspas e delimitador.");
  const [headers, ...records] = result.data;
  if (records.length > limits.rows)
    throw new InputError("too_many_rows", "Limite de 500 registros.", 413);
  if (
    headers.length > limits.columns ||
    headers.length !== columns.length ||
    new Set(headers).size !== headers.length ||
    columns.some((c) => !headers.includes(c.name))
  )
    fail(
      "header_mismatch",
      "Cabeçalho deve conter exatamente as colunas do contrato, sem repetição.",
    );
  const accepted = [],
    rejected = [],
    issues = [],
    seen = columns.map(() => new Map());
  for (let index = 0; index < records.length; index++) {
    const record = records[index],
      row = index + 2,
      normalized = Object.create(null),
      rowIssues = [];
    if (record.length !== headers.length)
      rowIssues.push({
        row,
        column: null,
        code: "field_count",
        message: "Quantidade de campos difere do cabeçalho.",
      });
    else
      columns.forEach((c, ci) => {
        const converted = convert(record[headers.indexOf(c.name)], c);
        if (converted.error)
          rowIssues.push({
            row,
            column: c.name,
            code: converted.error,
            message: `Valor não atende ao contrato de ${c.name}.`,
          });
        else {
          normalized[c.name] = converted.value;
          if (
            c.unique &&
            converted.value !== null &&
            seen[ci].has(converted.value)
          )
            rowIssues.push({
              row,
              column: c.name,
              code: "duplicate",
              message: `Valor já aceito no registro ${seen[ci].get(converted.value)}.`,
            });
        }
      });
    if (rowIssues.length) {
      rejected.push(row);
      issues.push(...rowIssues);
    } else {
      columns.forEach((c, ci) => {
        if (c.unique && normalized[c.name] !== null)
          seen[ci].set(normalized[c.name], row);
      });
      accepted.push({ row, values: normalized });
    }
  }
  let escaped = 0;
  const exportRows = accepted.map(({ values }) =>
    columns.map((c) => {
      const v = values[c.name];
      // Also guard whitespace-prefixed spreadsheet formulas. Numeric cells remain numeric.
      if (typeof v === "string" && /^[\s\uFEFF]*[=+\-@\t\r]/u.test(v)) {
        escaped++;
        return "'" + v;
      }
      return v ?? "";
    }),
  );
  const serialized = Papa.unparse(
    { fields: columns.map((c) => c.name), data: exportRows },
    { delimiter, newline: "\r\n" },
  );
  const clean = serialized.endsWith("\r\n") ? serialized : serialized + "\r\n";
  return {
    version: "1.0.0",
    summary: {
      total: records.length,
      accepted: accepted.length,
      rejected: rejected.length,
      issues: issues.length,
      formula_cells_escaped: escaped,
    },
    columns: columns.map((c) => ({ name: c.name, type: c.type })),
    accepted,
    rejected_rows: rejected,
    issues,
    clean_csv: clean,
    semantics: {
      row_numbers:
        "Logical CSV records, header is record 1; quoted newlines do not increment the record number.",
      duplicates:
        "First fully valid record wins; rejected records do not claim unique values.",
      retention: "No application storage. Processing is request-scoped.",
    },
  };
}
