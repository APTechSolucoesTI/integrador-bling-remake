---
name: security-integrations
description: Use ao lidar com tokens OAuth, secrets, webhooks, downloads externos, uploads e integrações de terceiros.
---

# Security for Integrations

## Segredos

- nunca versionar;
- nunca logar completos;
- mascarar;
- armazenar com proteção adequada;
- separar por tenant.

## HTTP

- HTTPS;
- timeout;
- limite de redirects;
- validar content type;
- limite de tamanho;
- evitar SSRF;
- validar hostname quando baixar recursos externos controlados por terceiros.

## Webhooks

Quando existentes:

- validar assinatura;
- proteger contra replay quando suportado;
- tornar processamento idempotente;
- responder rápido e processar pesado em fila.

## Logs

Logs podem conter IDs e contexto, mas não:

- access token;
- refresh token;
- client secret;
- senha;
- documento completo desnecessário.

## Demo

Gateways devem falhar fechado se modo demo tentar utilizar adapter real.
