# Arquitetura

O objetivo é estudar ingestão e qualidade de dados: parsing, contratos explícitos, normalização, unicidade e exportação resistente a fórmulas de planilha.

HTTP → itty-router → limite de bytes e contrato → Papa Parse → conversão e regras → relatório + Papa.unparse.

- `server/engine.mjs`: contrato, parsing, regras e exportação; função pura audit().
- `server/app.mjs`: HTTP, leitura limitada do stream, erros, Origin e headers.
- `server/examples.mjs`: dois conjuntos sintéticos.
- `server/openapi.mjs`: contrato OpenAPI.
- `app/api/[[...route]]/route.ts`: adaptador Vinext/Worker.
- `app/playground.tsx`: cliente técnico, sem regras locais de auditoria.
- `tests/`: motor e integração via TCP/HTTP real.
- `scripts/smoke.mjs`: fluxo externo contra o Worker local ou público.

Não há banco porque nada precisa sobreviver à requisição. Exportar reprocessa a entrada, evitando uploads guardados e links temporários. Não há sessão, fila, login ou cron. Não se promete persistência.

Um registro só é aceito quando todas as suas regras passam. Somente então suas chaves únicas entram nos Maps locais. Cada auditoria cria Maps novos; chamadas paralelas não compartilham estado. O resultado é determinístico para entradas iguais.

CSV malformado ou cabeçalho incompatível interrompem a requisição. Problemas de conteúdo ou quantidade de campos rejeitam apenas os registros afetados, sem correções silenciosas. O parser não executa fórmulas nem código enviado pelo usuário.
