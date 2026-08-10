# Mapa de integrações

| Integração        | Entradas legadas                                                 | Dados/efeitos                                                                                              | Riscos observados                                          | Destino planejado                                                        |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Bling API v3      | `callback.php`, `BlingTokenRefreshService.php`, `NFEService.php` | OAuth, tokens, NF-e, contatos, produtos/grupos, XML/PDF, boleto, objeto logístico/rastreio e cancelamentos | cURL espalhado, callback HTTP/IP fixo, refresh concorrente | `BlingGateway` por tenant, HTTP resiliente, lock distribuído e fake demo |
| Mercado Livre     | `app/control/callbackml.php`, `MercadolivreTokens.php`           | OAuth e taxas/dashboard                                                                                    | callback HTTP/IP fixo; escopo ainda incompleto             | `MercadoLivreGateway` real/fake por tenant                               |
| APChat            | `ApChatFormList.php`, `ApChat.php` e referências ainda a mapear  | Configuração e envio de mensagens                                                                          | efeito externo real e potencial duplicação                 | `ApChatGateway` real/fake, idempotência e bloqueio demo                  |
| Correios          | link em `NfeHeaderList.php`                                      | Rastreamento por código                                                                                    | URL externa; comportamento de consulta a confirmar         | Adapter ou link seguro conforme paridade                                 |
| Dashboard externo | `DashFinal.php`, `DashTaxasML.php`                               | Embeds por URL fixa                                                                                        | autorização e disponibilidade externas                     | Dashboard nativo após extrair métricas                                   |

## Regras de segurança da migração

- Nenhum segredo será copiado para código, fixture ou log.
- Credenciais serão separadas por tenant.
- `DEMO_MODE=true` falhará fechado antes de qualquer adapter real.
- Downloads externos terão allowlist/validação de host, timeout, redirects, tipo e tamanho.
- Callbacks/webhooks serão idempotentes e validarão assinatura quando o provedor oferecer suporte.

## Concorrência Bling observada

O refresh atual combina `flock` por unidade, `SELECT ... FOR UPDATE` e estados de token `S` (disponível), `R` (renovando) e `N` (revogado/inativo). Em `invalid_grant`, grava `N`; em sucesso, substitui os dois tokens e calcula expiração epoch. A implementação distribuída deverá preservar esses resultados observáveis sem depender do lock de arquivo local.
