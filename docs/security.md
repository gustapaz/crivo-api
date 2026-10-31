# Segurança e operação

Não há autenticação porque o serviço não guarda recursos por usuário. Não existem credenciais administrativas ou ações destrutivas globais. Cada chamada processa somente o corpo recebido.

A leitura do stream conta bytes reais e cancela acima de 64 KiB, mesmo sem Content-Length. Contrato, registros e células têm limites. Corpos comprimidos, regex personalizada e código executável não são aceitos. Objetos de saída usam protótipo nulo para tratar nomes de colunas como dados.

Origin de navegador deve coincidir com o serviço; clientes HTTP sem Origin são aceitos. Não há CORS permissivo ou cookies. Isso não é autenticação nem impede chamadas diretas por scripts externos.

Erros não expõem payloads, stacks ou detalhes internos. A API inclui no-store, nosniff, Referrer-Policy e request IDs. A aplicação não registra CSVs ou relatórios; a infraestrutura pode registrar metadados. Use somente dados sintéticos, nunca informações sensíveis.

A exportação neutraliza fórmulas textuais iniciadas por =, +, -, @, tab ou CR, inclusive com espaços iniciais, prefixando apóstrofo. JSON preserva o texto normalizado. Isso é uma proteção delimitada, sem garantia sobre todo importador de planilhas.

Não há rate limit global ou proteção DDoS própria. O trabalho por chamada é limitado; cotas e disponibilidade dependem da hospedagem. Nenhum cartão, faturamento, trial ou plano pago foi ativado. A demonstração não oferece SLA.

Os testes cobrem contratos, cabeçalhos, aspas, Unicode, limites, fórmulas, duplicatas, datas, números e chamadas paralelas. Eles comprovam esses comportamentos, sem certificar ausência universal de vulnerabilidades.
