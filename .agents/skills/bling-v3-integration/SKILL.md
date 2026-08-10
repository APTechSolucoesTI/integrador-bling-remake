---
name: bling-v3-integration
description: Use em qualquer alteração de OAuth, tokens, rate limit ou sincronização com API Bling v3.
---

# Bling v3 Integration

## Objetivo

Criar uma integração Bling isolada, resiliente, testável e multi-tenant.

## Estrutura

Use um gateway/client dedicado.

Não faça chamadas Bling diretamente de controllers React/Next.

## OAuth

Preservar:

- authorization code;
- access token;
- refresh token;
- expires_at;
- revogação;
- tratamento de 401;
- invalid_grant;
- reautorização.

## Concorrência

Refresh deve possuir lock distribuído por tenant.

Nunca permitir refresh simultâneo para a mesma credencial.

Preferir:

- Redis lock; ou
- PostgreSQL advisory lock.

## HTTP

Toda chamada deve possuir:

- timeout;
- tratamento de status;
- retry apenas quando seguro;
- backoff;
- rate limiting;
- logs sem segredo;
- correlation id.

## Idempotência

Sincronizações devem tolerar repetição.

Use IDs externos do Bling e constraints adequadas para impedir duplicação.

## Testes

Crie fixtures sanitizadas de:

- token válido;
- token expirado;
- 401;
- invalid_grant;
- rate limit;
- paginação;
- NF-e com/sem XML;
- boleto;
- rastreio;
- contato.

Mockar rede em testes e ambiente demo.
