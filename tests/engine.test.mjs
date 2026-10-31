import { test } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { audit } from "../server/engine.mjs";
import { examples } from "../server/examples.mjs";
const simple = (csv, column = { name: "value", type: "text" }) => ({
  csv,
  columns: [column],
});
const invalid = (input, code) =>
  assert.throws(
    () => audit(input),
    (e) => e.code === code,
  );
test("workshop: three accepted, three rejected, formula neutralized", () => {
  const r = audit(examples.workshops.request);
  assert.deepEqual(r.summary, {
    total: 6,
    accepted: 3,
    rejected: 3,
    issues: 3,
    formula_cells_escaped: 1,
  });
  assert.deepEqual(r.rejected_rows, [3, 4, 5]);
  assert.equal(r.accepted[0].values.email, "ana@example.test");
  assert.equal(r.accepted[0].values.name, "Ana Exemplo");
  assert.match(r.clean_csv, /'=1\+1/);
});
test("semicolon profile and enum normalization", () => {
  const r = audit(examples.library.request);
  assert.equal(r.summary.accepted, 2);
  assert.equal(r.accepted[0].values.code, "LIV-01");
  assert.equal(r.issues[0].code, "invalid_enum");
});
test("UTF-8 BOM, CRLF, quoted delimiter and embedded newline roundtrip", () => {
  const r = audit(simple('\uFEFFvalue\r\n"one,two"\r\n"three\nfour"\r\n'));
  assert.equal(r.summary.total, 2);
  assert.equal(r.accepted[1].row, 3);
  assert.deepEqual(Papa.parse(r.clean_csv, { skipEmptyLines: true }).data, [
    ["value"],
    ["one,two"],
    ["three\nfour"],
  ]);
});
test("columns may be reordered; export follows declared order", () => {
  const r = audit({
    csv: "b,a\nB,A",
    columns: [
      { name: "a", type: "text" },
      { name: "b", type: "text" },
    ],
  });
  assert.equal(r.clean_csv, "a,b\r\nA,B\r\n");
});
test("missing and extra fields reject only affected records", () => {
  const r = audit(simple("value\na,b\nvalid"));
  assert.equal(r.summary.rejected, 1);
  assert.equal(r.accepted[0].row, 3);
  assert.equal(r.issues[0].code, "field_count");
});
test("unterminated quoted field is structural failure", () =>
  invalid(simple('value\n"unfinished'), "malformed_csv"));
for (const csv of ["wrong\na", "value,value\na,b", "value,other\na,b"])
  test("header mismatch " + JSON.stringify(csv), () =>
    invalid(simple(csv), "header_mismatch"),
  );
test("optional blank becomes null and repeated null is not duplicate", () => {
  const r = audit({
    csv: "value,id\n,1\n,2",
    columns: [
      { name: "value", type: "text", required: false, unique: true },
      { name: "id", type: "integer" },
    ],
  });
  assert.equal(r.summary.accepted, 2);
  assert.equal(r.accepted[0].values.value, null);
});
test("required whitespace rejected; empty physical lines skipped", () => {
  const r = audit(simple("value\n\n   \nokay\n"));
  assert.equal(r.summary.total, 2);
  assert.equal(r.issues[0].code, "required");
});
test("duplicate keys normalize before comparison", () => {
  const r = audit(
    simple("value\n ABC \nabc", {
      name: "value",
      type: "text",
      case: "lower",
      unique: true,
    }),
  );
  assert.equal(r.summary.accepted, 1);
  assert.equal(r.issues[0].code, "duplicate");
});
test("rejected record does not poison unique values", () => {
  const r = audit({
    csv: "id,n\none,bad\none,2",
    columns: [
      { name: "id", type: "text", unique: true },
      { name: "n", type: "integer" },
    ],
  });
  assert.equal(r.summary.accepted, 1);
  assert.equal(r.accepted[0].row, 3);
});
for (const value of ["1.2", "01", "1e2", "NaN", "Infinity", "1000000001"])
  test("strict integer rejects " + value, () =>
    assert.equal(
      audit(simple("value\n" + value, { name: "value", type: "integer" }))
        .summary.rejected,
      1,
    ),
  );
test("number allows bounded six-place decimal and negative values", () => {
  const r = audit(
    simple("value\n-12.345678\n1.0000001", { name: "value", type: "number" }),
  );
  assert.equal(r.accepted[0].values.value, -12.345678);
  assert.equal(r.summary.rejected, 1);
  assert.equal(r.summary.formula_cells_escaped, 0);
});
test("min and max are inclusive", () => {
  const r = audit(
    simple("value\n1\n5\n6\n0", {
      name: "value",
      type: "integer",
      min: 1,
      max: 5,
    }),
  );
  assert.equal(r.summary.accepted, 2);
  assert.equal(r.summary.rejected, 2);
});
test("calendar rejects invalid dates, accepts leap day", () => {
  const r = audit(
    simple("value\n2024-02-29\n2026-02-29\n2026-13-01\n01/01/2026", {
      name: "value",
      type: "date",
    }),
  );
  assert.equal(r.summary.accepted, 1);
  assert.equal(r.summary.rejected, 3);
});
test("email format and lowercase", () => {
  const r = audit(
    simple("value\nTEST@EXAMPLE.TEST\nnot-an-email", {
      name: "value",
      type: "email",
      case: "lower",
    }),
  );
  assert.equal(r.accepted[0].values.value, "test@example.test");
  assert.equal(r.summary.rejected, 1);
});
test("formula guards text even with whitespace; JSON remains unmodified", () => {
  const r = audit(
    simple('value\n=1+1\n +cmd\n-1\n@thing\n"\t=2"', {
      name: "value",
      type: "text",
      trim: false,
    }),
  );
  assert.equal(r.summary.formula_cells_escaped, 5);
  assert.equal(r.accepted[0].values.value, "=1+1");
  assert.equal(
    Papa.parse(r.clean_csv, { skipEmptyLines: true }).data[2][0],
    "' +cmd",
  );
});
test("500 records accepted, 501 rejected before processing", () => {
  assert.equal(
    audit(simple("value\n" + Array(500).fill("a").join("\n"))).summary.accepted,
    500,
  );
  invalid(simple("value\n" + Array(501).fill("a").join("\n")), "too_many_rows");
});
test("cells over 500 characters are rejected", () =>
  assert.equal(
    audit(simple("value\n" + "x".repeat(501))).issues[0].code,
    "cell_too_long",
  ));
test("header-only valid file exports header", () =>
  assert.equal(audit(simple("value")).clean_csv, "value\r\n"));
test("all rejected still exports header", () =>
  assert.equal(
    audit(simple("value\nnope", { name: "value", type: "integer" })).clean_csv,
    "value\r\n",
  ));
test("prototype-like column name remains ordinary data", () => {
  const r = audit(
    simple("constructor\nsafe", { name: "constructor", type: "text" }),
  );
  assert.equal(r.accepted[0].values.constructor, "safe");
  assert.equal({}.polluted, undefined);
});
test("deterministic result and input not mutated", () => {
  const input = structuredClone(examples.workshops.request),
    before = structuredClone(input);
  assert.deepEqual(audit(input), audit(input));
  assert.deepEqual(input, before);
});
for (const input of [
  null,
  [],
  {},
  { csv: "v\nx", columns: [] },
  { csv: "v\nx", columns: [{ name: "v", type: "unknown" }] },
  { csv: "v\nx", columns: [{ name: "v", type: "text", unique: "yes" }] },
  { csv: "v\nx", delimiter: "|", columns: [{ name: "v", type: "text" }] },
])
  test("reject invalid contract " + JSON.stringify(input), () =>
    assert.throws(
      () => audit(input),
      (e) => e.status === 422,
    ),
  );
test("reject incompatible rules, unknown properties and duplicate column names", () => {
  for (const column of [
    { name: "value", type: "text", min: 1 },
    { name: "value", type: "integer", case: "lower" },
    { name: "value", type: "number", min: 2, max: 1 },
    { name: "value", type: "text", values: ["a"] },
    { name: "value", type: "enum", values: [] },
    { name: "value", type: "text", surprise: true },
  ])
    invalid(simple("value\na", column), "invalid_schema");
  invalid(
    {
      csv: "a\nx",
      columns: [
        { name: "a", type: "text" },
        { name: "a", type: "text" },
      ],
    },
    "invalid_schema",
  );
});
