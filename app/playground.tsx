"use client";
import { useState } from "react";
import { examples } from "../server/examples.mjs";
type Report = {
  summary: {
    total: number;
    accepted: number;
    rejected: number;
    issues: number;
    formula_cells_escaped: number;
  };
  issues: {
    row: number;
    column: string | null;
    code: string;
    message: string;
  }[];
  accepted: { row: number; values: Record<string, unknown> }[];
  clean_csv: string;
};
export default function Playground() {
  const initial = examples.workshops.request;
  const [csv, setCsv] = useState(initial.csv),
    [columns, setColumns] = useState(JSON.stringify(initial.columns, null, 2)),
    [delimiter, setDelimiter] = useState<string>(initial.delimiter),
    [report, setReport] = useState<Report | null>(null),
    [payload, setPayload] = useState<string>(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  function clear() {
    setReport(null);
    setPayload("");
    setMessage("");
  }
  function load(id: keyof typeof examples) {
    const e = examples[id].request;
    setCsv(e.csv);
    setColumns(JSON.stringify(e.columns, null, 2));
    setDelimiter(e.delimiter);
    clear();
  }
  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    clear();
    try {
      const body = JSON.stringify({
        csv,
        delimiter,
        columns: JSON.parse(columns),
      });
      const response = await fetch("/api/v1/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const result = (await response.json()) as Report & {
        title?: string;
        code?: string;
      };
      if (!response.ok)
        throw new Error(
          `${response.status} · ${result.title} (${result.code})`,
        );
      setReport(result);
      setPayload(body);
      setMessage(
        `Auditoria concluída: ${result.summary.accepted} aceitos e ${result.summary.rejected} rejeitados.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao consultar a API.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!response.ok) throw new Error("Não foi possível exportar o CSV.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "crivo-clean.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("CSV tratado recebido do servidor e enviado para download.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na exportação.");
    } finally {
      setBusy(false);
    }
  }
  async function file(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    clear();
    if (!selected) return;
    if (selected.size > 65536) {
      setMessage("Arquivo excede 64 KiB.");
      event.target.value = "";
      return;
    }
    try {
      setCsv(await selected.text());
      setMessage(
        "Arquivo carregado localmente. Só será enviado ao clicar em Auditar no servidor.",
      );
    } catch {
      setMessage("Não foi possível ler o arquivo.");
    }
  }
  return (
    <section id="laboratorio" aria-labelledby="lab-title" className="lab">
      <div className="section-title">
        <span className="index">01 / REQUISIÇÃO</span>
        <h2 id="lab-title">O arquivo entra. As regras decidem.</h2>
        <p>
          Use os exemplos sintéticos ou edite o CSV e seu contrato. O
          processamento acontece na API, sem armazenamento pela aplicação. Não
          envie dados pessoais ou sensíveis.
        </p>
      </div>
      <div className="presets">
        <button disabled={busy} onClick={() => load("workshops")}>
          Exemplo: oficinas
        </button>
        <button disabled={busy} onClick={() => load("library")}>
          Exemplo: biblioteca
        </button>
      </div>
      <form onSubmit={run}>
        <div className="input-grid">
          <div>
            <label htmlFor="csv">CSV com cabeçalho</label>
            <textarea
              id="csv"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                clear();
              }}
              disabled={busy}
              spellCheck={false}
              rows={13}
            />
            <label htmlFor="file">Ou abrir um arquivo CSV (até 64 KiB)</label>
            <input
              id="file"
              type="file"
              accept=".csv,text/csv"
              onChange={file}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="columns">Contrato de colunas · JSON</label>
            <textarea
              id="columns"
              value={columns}
              onChange={(e) => {
                setColumns(e.target.value);
                clear();
              }}
              disabled={busy}
              spellCheck={false}
              rows={13}
            />
            <label htmlFor="delimiter">Delimitador</label>
            <select
              id="delimiter"
              value={delimiter}
              onChange={(e) => {
                setDelimiter(e.target.value);
                clear();
              }}
              disabled={busy}
            >
              <option value=",">Vírgula</option>
              <option value=";">Ponto e vírgula</option>
              <option value={"\t"}>Tabulação</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Processando…" : "Auditar no servidor →"}
          </button>
          <button type="button" disabled={!report || busy} onClick={download}>
            Baixar CSV tratado ↓
          </button>
          <span>POST /api/v1/audit</span>
        </div>
      </form>
      <p role="status" aria-live="polite" className="status">
        {message || "Pronto para uma requisição real."}
      </p>
      {report && (
        <div className="results">
          <span className="index">02 / RESPOSTA HTTP 200</span>
          <div className="metrics">
            {[
              ["Registros", report.summary.total],
              ["Aceitos", report.summary.accepted],
              ["Rejeitados", report.summary.rejected],
              ["Fórmulas neutralizadas", report.summary.formula_cells_escaped],
            ].map(([name, value]) => (
              <div key={name}>
                <strong>{value}</strong>
                <span>{name}</span>
              </div>
            ))}
          </div>
          <h3>Diagnóstico por registro</h3>
          {report.issues.length ? (
            <div className="table-wrap">
              <table>
                <caption>
                  Problemas encontrados; números indicam registros lógicos,
                  incluindo o cabeçalho.
                </caption>
                <thead>
                  <tr>
                    <th>Registro</th>
                    <th>Coluna</th>
                    <th>Código</th>
                    <th>Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.map((issue, i) => (
                    <tr key={i}>
                      <td>{issue.row}</td>
                      <td>{issue.column ?? "—"}</td>
                      <td>
                        <code>{issue.code}</code>
                      </td>
                      <td>{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nenhum problema encontrado.</p>
          )}
          <details>
            <summary>
              Inspecionar registros aceitos ({report.summary.accepted})
            </summary>
            <pre>{JSON.stringify(report.accepted, null, 2)}</pre>
          </details>
          <details>
            <summary>Inspecionar CSV tratado</summary>
            <pre>{report.clean_csv}</pre>
          </details>
          <p className="note">
            A exportação contém somente registros integralmente válidos.
            Fórmulas textuais recebem um apóstrofo no CSV; o JSON preserva o
            conteúdo normalizado.
          </p>
        </div>
      )}
    </section>
  );
}
