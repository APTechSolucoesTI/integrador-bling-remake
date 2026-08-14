# Arquitetura do banco do produto

## Fonte de verdade

`packages/db/prisma/schema.prisma` é a descrição canônica. `packages/db/prisma/migrations` constrói o banco desde zero e não depende de introspecção do legado. Uma mudança de schema exige uma migration nova; `db pull` e `db push` não fazem parte do fluxo.

```text
Bling / APChat / Mercado Livre
             │
       API + worker
             │
    DATABASE_URL (novo PostgreSQL)

LEGACY_DATABASE_URL (somente leitura)
             │
     importador de cutover
             └──────────────► novo PostgreSQL
```

O banco contém o control plane (`saas_*`), domínio fiscal/comercial, documentos, custos, tributação, metas, agenda, auditoria e checkpoints de importação. IDs UUID identificam tenants e identidades; IDs inteiros permanecem nas entidades de domínio para compatibilidade das APIs. Valores financeiros usam `Decimal` e datas operacionais usam `timestamptz`.

`invoice_overview` é uma read model criada pela migration a partir das tabelas modernas. Ela concentra projeções repetidas do dashboard e de NF-e, sem consultar a antiga `view_nfe`.

## Ambientes e comandos

- `DATABASE_URL`: banco exclusivo do produto.
- `SHADOW_DATABASE_URL`: shadow database de desenvolvimento, quando necessário.
- `LEGACY_DATABASE_URL`: origem antiga, opcional, acesso somente leitura.
- `TOKEN_ENCRYPTION_KEY_BASE64`: chave de 32 bytes para segredos OAuth/APChat.

```powershell
corepack pnpm db:migrate:dev      # desenvolvimento
corepack pnpm db:migrate:deploy   # CI/staging/produção
corepack pnpm db:seed             # defaults idempotentes
corepack pnpm db:bootstrap:clean  # prova completa em banco vazio
```

## Credenciais Bling

`OAuthCredential` armazena `accessTokenCiphertext` e `refreshTokenCiphertext` como payload AES-256-GCM versionado. A chave vem exclusivamente de `TOKEN_ENCRYPTION_KEY_BASE64`; plaintext não é persistido, retornado pela API, inserido em auditoria ou emitido pelos comandos operacionais.

O bootstrap `bling:import-token` renova primeiro o refresh token em memória usando o mesmo `BlingOAuthHttpGateway` do worker, exige `enable-jwt: 1`, persiste imediatamente o novo par de tokens cifrado e faz um GET mínimo. `bling:smoke` limita a sincronização a 1–5 NF-e e usa o mesmo processor do worker. A credencial do aplicativo é resolvida de `BLING_CLIENT_ID` e `BLING_CLIENT_SECRET` (ou de ciphers por tenant, quando configurados); elas devem ser do mesmo aplicativo que emitiu o refresh token.

## Importação futura

`corepack pnpm db:migrate-legacy` descobre tabelas, conta registros e grava checkpoints em `legacy_import_run`. A conexão de origem ativa `default_transaction_read_only`. A opção `--execute` importa empresas com upsert por `legacyUnitId` e registra cada correspondência em `legacy_entity_mapping`; repetir o comando não duplica dados.

Os estágios seguintes estão ordenados por dependência: usuários, configurações, comercial, contatos, produtos, fiscal, pedidos, notas/itens, documentos e metas. Eles só devem ser habilitados após snapshot, reconciliação de contagens/valores e ensaio de rollback.

## Cutover

1. Fazer backup e impedir novas escritas no legado.
2. Rodar descoberta e validar divergências.
3. Executar importação por estágios, retomando pelos checkpoints.
4. Reconciliar tenants, notas, itens, valores e tokens.
5. Iniciar API/worker/web exclusivamente com `DATABASE_URL`.
6. Manter o legado congelado até o aceite; rollback apenas troca o tráfego, sem escrever na origem.
