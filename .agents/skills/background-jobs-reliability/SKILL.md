---
name: background-jobs-reliability
description: Use para migrar crontabs, sincronizações, workers e rotinas demoradas para BullMQ/Redis.
---

# Background Jobs Reliability

## Princípio

Jobs de integração precisam ser idempotentes, observáveis e recuperáveis.

## Todo job deve ter

- tenantId;
- jobType;
- payload;
- correlationId;
- attempt;
- createdAt;
- startedAt;
- finishedAt;
- status.

## BullMQ

Configurar:

- attempts;
- exponential backoff;
- jitter quando possível;
- timeout;
- concurrency explícita;
- rate limiter quando necessário.

## Idempotência

Antes de criar um job duplicado, determine uma chave estável.

Exemplos:

- tenant + nfe externa;
- tenant + período + tipo de sincronização;
- tenant + evento externo.

## Falhas

Diferencie:

- transitória;
- autenticação;
- rate limit;
- dado inválido;
- falha permanente.

Não retry infinito.

## UI operacional

Expor histórico de execução e erro sanitizado.

Permitir reprocessamento seguro somente quando o job for idempotente.
