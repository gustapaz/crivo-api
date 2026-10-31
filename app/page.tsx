import Playground from "./playground";
export default function Home() {
  return (
    <main>
      <header>
        <a className="brand" href="/">
          CRIVO<span>API</span>
        </a>
        <nav aria-label="Recursos">
          <a href="/docs.html">Swagger ↗</a>
          <a href="/api/openapi.json">OpenAPI ↗</a>
          <a href="https://github.com/gustapaz/crivo-api">GitHub ↗</a>
        </nav>
      </header>
      <section className="intro">
        <p className="eyebrow">CSV QUALITY GATE / JAVASCRIPT BACK-END</p>
        <h1>
          Antes de importar,
          <br />
          <em>passe pelo Crivo.</em>
        </h1>
        <p className="lead">
          Uma API para transformar arquivos inconsistentes em dados que
          respeitam um contrato. Validação, normalização, duplicatas e
          exportação segura — de verdade, no servidor.
        </p>
        <div className="pipeline" aria-label="Etapas do processamento">
          <span>CSV + contrato</span>
          <b>→</b>
          <span>Parser e validação</span>
          <b>→</b>
          <span>Relatório + CSV tratado</span>
        </div>
        <p className="stack">
          JavaScript ES Modules · itty-router · Papa Parse · Node.js test runner
        </p>
      </section>
      <Playground />
      <section className="spec">
        <div>
          <span className="index">03 / COMPORTAMENTO</span>
          <h2>
            Regras explícitas.
            <br />
            Resultado reproduzível.
          </h2>
        </div>
        <dl>
          <dt>Primeiro válido vence</dt>
          <dd>
            Duplicatas são comparadas depois da normalização, apenas entre
            registros integralmente válidos. Um registro rejeitado não ocupa uma
            chave única.
          </dd>
          <dt>Sem inferências silenciosas</dt>
          <dd>
            Você define delimitador, colunas e tipos. Cabeçalhos inesperados e
            aspas malformadas interrompem a auditoria; falhas de conteúdo
            aparecem por registro.
          </dd>
          <dt>Fórmulas ficam como texto</dt>
          <dd>
            A exportação neutraliza células textuais iniciadas por =, +, - ou @,
            inclusive após espaços. Números negativos válidos continuam
            numéricos.
          </dd>
          <dt>Sem arquivos guardados</dt>
          <dd>
            O serviço é stateless. A aplicação não grava uploads, relatórios ou
            contas; cada exportação reprocessa a entrada. O navegador mantém os
            resultados somente na memória da página.
          </dd>
        </dl>
      </section>
      <aside>
        <strong>Limites da demo pública</strong>
        <p>
          64 KiB por requisição JSON, 500 registros, 12 colunas e 500 caracteres
          por célula normalizada. Até 6 casas decimais e números entre -1e9 e
          1e9. Sem autenticação, efeitos externos, cartão ou faturamento. A
          hospedagem possui limites próprios de disponibilidade; use somente
          dados sintéticos.
        </p>
        <a href="/api/health">Consultar health →</a>
      </aside>
      <footer>
        <span>Crivo API · Gustavo Paz</span>
        <span>Um serviço. Nenhum banco desnecessário.</span>
      </footer>
    </main>
  );
}
