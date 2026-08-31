# Status da modernização

Atualizado em: 2026-08-24

## Produto implementado

- Web Next.js, API NestJS e worker BullMQ no monorepo pnpm.
- Landing, login, demo pública e áreas autenticadas de dashboard, NF-e, documentos, produtos, pessoas, comercial, fiscal, financeiro, metas, operações e administração.
- Demo alinhada ao produto: entradas por sincronização, ações manipuláveis persistidas no navegador e nenhum efeito externo.
- Sessão opaca, cookie HttpOnly, RBAC, memberships e isolamento por tenant UUID.
- Sincronizações Bling de notas, detalhes, XML, documentos, produtos, pedidos e cadastros auxiliares.
- Cálculo fiscal/financeiro decimal, normalização manual de itens, custos, impostos, créditos, lucro e margem.
- OAuth Bling/Mercado Livre e APChat por empresa, com tokens/segredos cifrados por AES-256-GCM.
- BullMQ com retry, backoff, tracking, idempotência e agenda operacional por empresa.
- Exportações CSV, estados de carregamento/erro/vazio e demo responsiva.
- Homologação Bling real concluída no tenant APTech: 5.430 produtos, 7 grupos de fabricação própria, 219 pedidos e 238 NF-e persistidos; 213 NF-e calculadas ponta a ponta.
- Estrutura comercial ampliada com pedidos de venda e CRUD de setores.
- Crédito de ICMS corrigido para `custo dos produtos × alíquota`; Lucro e Margem permite ressincronizar uma NF-e e recalcular a composição financeira.
- Detalhe financeiro da NF-e expõe desconto, frete e outras despesas (`vOutro`) por item e destaca visualmente inconsistências de vínculo/cálculo.
- Listagens de NF-e e Lucro restauram filtros e paginação ao voltar de um detalhe; Lucro e Taxas ML possuem expansão inline por NF-e com todos os itens e atalho seguro para o cadastro do produto no Bling.
- Frete fiscal corrigido: valor do XML prevalece e frete do pedido serve somente como fallback; backfill seguro corrigiu notas já calculadas. Sincronização normal aceita apenas situações 5/6, deixando cancelamentos no fluxo dedicado.
- DIFAL de destinatário não contribuinte segue a alíquota interna configurada por UF, como no `NFEService`; canceladas também são bloqueadas em ressincronizações e recálculos manuais.
- Regime tributário voltou à configuração por unidade. O cálculo de NF-e separa LP e SN conforme `NFEService`: SN não soma tributos/créditos exclusivos de LP e preserva custos/taxas configurados aplicáveis.
- Dashboard de lucro expõe Taxas e Frete como KPIs e no relatório auditável/CSV.
- Importação inteligente CSV disponível em Produtos, Pessoas, NF-e, Documentos, Comercial e Operações: detecta separador/codificação, sugere mapeamento por aliases, mostra prévia, valida campos e faz upsert tenant-aware em 12 cadastros Bling.

## Banco independente concluído

- PostgreSQL próprio; o legado não participa do runtime.
- Schema Prisma integral com control plane, domínio operacional, constraints, índices e relações tenant-aware.
- Migration inicial única capaz de construir um banco vazio.
- `invoice_overview` moderna substitui a dependência da antiga `view_nfe`.
- Seed idempotente com tenant demo e configurações iniciais.
- Importador legado somente leitura, com descoberta, checkpoints e primeiro estágio idempotente de tenants.
- Mapa de todas as tabelas auditadas em `docs/legacy-to-modern-database-map.md`.
- Bootstrap efêmero comprovado: migration, generate, seed, build, API, worker e web.

## Validação atual

- Prisma validate: passou.
- Typecheck de 7 projetos: passou.
- Lint global: passou.
- Testes: 55 passaram.
- Build completo: passou, incluindo 19 rotas Next.js.
- Bootstrap limpo em PostgreSQL 18 efêmero: passou.
- Navegador integrado: indisponível no ambiente nesta execução; não há afirmação de QA visual novo.
- Sincronização real Bling: produtos, pedidos e NF-e concluíram no worker; erros de enum PostgreSQL e regime tributário corrigidos.

## Pendências externas

- Instalar o peer `ioredis` usado pelo BullMQ. O registry npm deste ambiente está retornando certificado de outro domínio, então a instalação segura foi bloqueada; não foi desabilitada a validação TLS.
- Homologar integrações com credenciais reais de Bling, APChat e Mercado Livre.
- Habilitar transformadores restantes do importador apenas no ensaio de cutover com snapshot real/sanitizado.
- Criar/aplicar as tabelas no Supabase somente na fase aprovada pelo responsável.
