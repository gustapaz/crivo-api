# Crivo API

Auditoria de CSV por contrato. Back-end em **JavaScript ES Modules + itty-router + Papa Parse**, com validação, normalização, duplicatas e exportação segura.

[Demo](https://crivo-api-gustapaz.starrylinen.chatgpt.site) · [Swagger](https://crivo-api-gustapaz.starrylinen.chatgpt.site/docs.html) · [OpenAPI](https://crivo-api-gustapaz.starrylinen.chatgpt.site/api/openapi.json)

## Recursos

- Tipos text, integer, number, email, date e enum.
- Campos obrigatórios/opcionais, unicidade, trim, case e limites numéricos.
- Datas válidas, campos entre aspas, quebras de linha, BOM e CRLF.
- Relatório por registro/coluna e exportação só dos registros aceitos.
- Fórmulas textuais neutralizadas no CSV, inclusive após espaços iniciais.
- Serviço stateless: não guarda arquivos, relatórios, contas ou sessões.

Exemplos são sintéticos. Parsing, validação e exportação são reais no servidor. Não há integrações comerciais ou processamento externo simulado.

## Executar

Node.js 24 e npm; sem conta de cloud, cartão ou segredo.

```sh
npm ci
npm run build
npm start -- --port 5201
```

Abra http://127.0.0.1:5201 e /docs.html. Sem banco ou migrações: nenhum dado precisa sobreviver à requisição. Exemplos ficam em GET /api/v1/examples e examples/requests/.

```sh
npm run check
npm run typecheck
npm test
npm run smoke -- http://127.0.0.1:5201
```

47 testes do motor e integração com HTTP real, sem mocks do parser. A CI instala do lockfile, verifica formatação e tipos do adaptador, testa e compila. A lógica JavaScript é validada pelos testes. O smoke verifica o Worker local ou público, exportação, erros e chamadas paralelas.

## API

Endpoints públicos, sem login. Use apenas dados sintéticos.

```sh
curl https://crivo-api-gustapaz.starrylinen.chatgpt.site/api/health
curl -X POST https://crivo-api-gustapaz.starrylinen.chatgpt.site/api/v1/audit -H 'Content-Type: application/json' --data-binary @examples/requests/workshops.json
curl -X POST https://crivo-api-gustapaz.starrylinen.chatgpt.site/api/v1/export -H 'Content-Type: application/json' --data-binary @examples/requests/workshops.json -o crivo-clean.csv
```

O exemplo de oficinas retorna 6 registros, 3 aceitos, 3 rejeitados e 1 fórmula neutralizada. Falhas em registros retornam 200 com diagnóstico. Contrato/cabeçalho inválido ou CSV malformado retornam 422; JSON inválido, 400; tamanho excedido, 413; mídia incorreta, 415. Erros usam application/problem+json e request_id.

## Semântica

Delimitador explícito: vírgula, ponto e vírgula ou tab. Cabeçalho exato, com nomes únicos e ordem livre. Exportação segue a ordem do contrato. Registros são lógicos, contando cabeçalho como 1; quebras dentro de aspas não incrementam a numeração. Linhas vazias são ignoradas.

Unicidade é avaliada após normalização. Primeiro registro integralmente válido vence; rejeitados não ocupam valores. Vazios opcionais viram null e não disputam unicidade. Números usam ponto, até 6 casas decimais e módulo máximo 1e9; não são aritmética financeira exata. E-mail tem verificação sintática, sem envio ou consulta de domínio.

JSON preserva textos normalizados. CSV prefixa fórmulas textuais com apóstrofo, alterando intencionalmente a exportação. Limites: 64 KiB para o corpo JSON completo, 500 registros, 12 colunas e 500 caracteres por célula normalizada.

## Arquitetura e hospedagem

[Arquitetura](docs/architecture.md) · [Segurança](docs/security.md)

A API usa JavaScript, itty-router e Papa Parse. Vinext/React fornece o adaptador Worker e a página técnica, sem regras locais de auditoria. Não há persistência: cada exportação reprocessa a entrada.

A demo usa Sites, sem cartão, faturamento ou plano pago ativado. GitHub hospeda código e CI; Pages não executa a API. Cotas e disponibilidade dependem da hospedagem, sem promessa de gratuidade permanente ou SLA. Não há rate limit global próprio; o trabalho por chamada é limitado. Não envie informações sensíveis.

Credenciais de publicação ficam fora do Git. Nenhuma variável secreta é necessária; veja .env.example.

## Licença

MIT para código do projeto. Dependências mantêm suas licenças. Swagger UI conserva LICENSE/NOTICE em public/swagger; tooling Sites/Vinext conserva avisos em vendor e scripts/vite/sites-vite-plugin.LICENSE.
