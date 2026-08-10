# Runtime legado

## Requisitos observados

- PHP compatível com o Adianti/MadBuilder versionado.
- Extensão PDO PostgreSQL e cURL; outras extensões deverão ser confirmadas pelo instalador e por análise estática.
- Dependências Composer já estão versionadas no clone, incluindo PHPMailer, DOMPDF, geradores de QR/barcode e bibliotecas de planilha/PDF.
- PostgreSQL com bases/configurações `integrador_aptech`, `permission`, `communication` e `log`.

## Entradas

- Web: `index.php` / `engine.php`.
- REST: `rest.php`, `MadRestServer.php`, `app/routes/api.php`.
- OAuth Bling: `callback.php`.
- OAuth Mercado Livre: `app/control/callbackml.php`.
- CLI: `cmd.php` (uso e comandos ainda pendentes de caracterização).
- Download: `download.php` (validações ainda pendentes de auditoria).

## Configuração

O arquivo `app/config/integrador_aptech.php` aponta para PostgreSQL e está sem credenciais no repositório clonado. Não há conexão local configurada nesta etapa. URLs fixas encontradas em callbacks e dashboards devem ser parametrizadas na implementação moderna, sem alterar silenciosamente o comportamento do legado.

## Como validar o legado

O executável `php` não está instalado/disponível no PATH deste workspace. Portanto, lint e execução do legado não puderam ser realizados nesta etapa. Ainda está pendente documentar versão PHP exata, extensões, bootstrap das quatro bases, dados mínimos e comandos de smoke test. Até isso ser comprovado, fixtures golden master poderão ser derivadas apenas de fluxos cuja execução local seja reproduzível ou de saídas sanitizadas fornecidas.
