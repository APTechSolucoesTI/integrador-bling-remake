# PROMPT MESTRE — MIGRAÇÃO INTEGRADOR BLING PARA STACK MODERNA

Você é o arquiteto principal e engenheiro responsável pela modernização completa deste repositório legado.

## Missão

Migrar o sistema existente deste repositório, atualmente implementado principalmente em PHP com Adianti Framework/MadBuilder e PostgreSQL, para uma aplicação moderna, comercializável, escalável e sustentável em TypeScript/Node.js, preservando integralmente as regras de negócio e o comportamento funcional que já existem.

O sistema legado É A ESPECIFICAÇÃO FUNCIONAL.

Não faça uma reescrita baseada apenas em nomes de telas ou tabelas. Leia o código legado, rastreie os fluxos, descubra efeitos colaterais, integrações, consultas, cálculos, estados, jobs, permissões e regras implícitas antes de substituir qualquer módulo.

A modernização deve resultar em um produto SaaS multiempresa que possa ser vendido para novos clientes sem permanecer acoplado ao cliente original.

## Autonomia

Você está autorizado a:

- ler todo o repositório;
- criar e editar arquivos locais;
- instalar dependências;
- executar builds, linters, typecheck, testes e migrations locais não destrutivas;
- criar scripts de análise, fixtures, mocks e testes;
- reorganizar a estrutura do projeto;
- criar Dockerfiles e docker-compose;
- criar documentação;
- implementar a migração de ponta a ponta.

Não interrompa o trabalho para pedir confirmação sobre decisões técnicas reversíveis e locais.

Somente pare se precisar de:

- credenciais reais inexistentes;
- acesso externo que não esteja disponível;
- uma ação destrutiva sobre dados reais;
- alteração de produção;
- push/deploy externo não autorizado.

Nesses casos, implemente tudo que puder usando interfaces, mocks, fixtures e variáveis de ambiente e documente exatamente o que falta.

Não faça push, deploy em produção ou alteração de banco de produção sem autorização explícita.

## Regra máxima

NÃO apague nem destrua o legado durante a migração.

Mantenha o sistema PHP disponível como referência até que exista evidência de paridade funcional.

Se for necessário reorganizar o repositório, preserve o legado em uma área claramente identificada, por exemplo `legacy/`, ou mantenha-o intacto durante as primeiras fases.

## Funcionalidades que já aparecem no legado e precisam ser investigadas

O inventário inicial deve procurar, entre outras, as áreas abaixo:

- autenticação, usuários, grupos, unidades e permissões;
- multiempresa baseada em `unit_id`;
- tokens OAuth do Bling;
- renovação e revogação de tokens;
- rate limiting da API Bling;
- sincronização manual e automática;
- NF-e;
- itens de NF-e;
- XML de NF-e;
- PDF/DANFE;
- boletos;
- códigos de rastreamento;
- pessoas/clientes;
- endereços;
- produtos;
- vendedores;
- canais de venda;
- Mercado Livre;
- APChat;
- status e observações de envio;
- formas de pagamento;
- natureza de operação;
- tributação;
- DIFAL;
- créditos fiscais;
- custos;
- custos fixos;
- taxas;
- parcelamento;
- cálculo de custo, imposto, lucro e margem;
- metas;
- dashboards;
- pesquisa de satisfação;
- preferências gerais;
- horários;
- crontab;
- logs de jobs;
- relatórios;
- geração de PDF, código de barras, QR Code e planilhas;
- qualquer callback, endpoint REST ou rotina CLI existente.

Essa lista NÃO é exaustiva. Descubra o restante no código.

## Arquitetura alvo

Use TypeScript em todo código novo.

Estruture preferencialmente como monorepo pnpm:

- `apps/web`
  - Next.js
  - App Router
  - React
  - Tailwind CSS
  - shadcn/ui
  - TanStack Table
  - React Hook Form
  - Zod
  - Recharts
  - frontend administrativo responsivo

- `apps/api`
  - Node.js
  - NestJS
  - API modular por domínio
  - validação com Zod ou DTOs equivalentes
  - OpenAPI
  - autenticação/autorização
  - serviços de domínio
  - integrações externas

- `apps/worker`
  - Node.js/TypeScript
  - BullMQ
  - Redis
  - processamento assíncrono
  - sincronizações
  - retries
  - backoff
  - jobs agendados
  - locks distribuídos

- `packages/db`
  - PostgreSQL
  - Prisma
  - introspecção inicial do banco existente
  - migrations controladas
  - repositórios/queries compartilhados

- `packages/domain`
  - regras de negócio puras
  - cálculos
  - estados
  - políticas
  - sem dependência de UI

- `packages/integrations`
  - `bling`
  - `apchat`
  - `mercadolivre`
  - adapters e clients isolados

- `packages/contracts`
  - schemas Zod
  - tipos compartilhados
  - contratos de API/eventos

- `packages/ui`
  - componentes reutilizáveis e design system

Evite colocar regras de integração pesada, sincronização ou jobs longos dentro do runtime do Next.js.

## Banco de dados

O PostgreSQL atual deve ser tratado como patrimônio do sistema, não como algo descartável.

Primeiro:

1. descubra onde estão as configurações e schemas;
2. catalogue todas as tabelas, views, sequences, constraints, índices e relacionamentos usados pelo legado;
3. execute introspecção;
4. gere `docs/database-map.md`;
5. identifique tabelas de framework versus tabelas de negócio;
6. identifique dependências de `unit_id`;
7. identifique queries SQL manuais;
8. identifique comportamento que depende de NULL, defaults, enums informais ou status numéricos.

Não crie uma migration destrutiva apenas para “deixar o schema bonito”.

Na primeira versão moderna, prefira compatibilidade com o schema atual.

Depois que a paridade estiver comprovada, proponha migrations evolutivas.

Qualquer migration destrutiva deve possuir:

- justificativa;
- backup;
- plano de rollback;
- validação;
- script de migração de dados.

## Multi-tenancy / produto comercial

Transforme o conceito atual de unidade/empresa em um modelo SaaS explícito.

O produto deve suportar:

- múltiplas organizações/tenants;
- isolamento de dados;
- usuários pertencendo a uma ou mais organizações;
- papéis e permissões;
- credenciais Bling independentes por tenant;
- credenciais APChat independentes por tenant;
- configuração por tenant;
- branding básico por tenant;
- feature flags;
- auditoria;
- logs por tenant.

Sempre derive o tenant no servidor.

Nunca confie em `tenant_id` enviado livremente pelo frontend sem validação de autorização.

Durante a migração, preserve compatibilidade com `unit_id` e documente claramente o mapeamento entre `unit_id` legado e o tenant moderno.

## Ambiente DEMONSTRAÇÃO

Crie um ambiente de demonstração real e seguro.

Requisitos:

- tenant chamado `Demonstração`;
- dados fictícios realistas;
- seed reproduzível;
- usuário demo;
- dashboards populados;
- NF-es fictícias;
- clientes fictícios;
- produtos fictícios;
- boletos fictícios;
- rastreios fictícios;
- métricas fictícias;
- integrações em modo MOCK;
- nenhuma chamada real ao Bling/APChat/Mercado Livre;
- nenhum WhatsApp/mensagem/email real;
- nenhuma credencial de cliente;
- banner visual informando “Ambiente de demonstração”;
- possibilidade de resetar os dados demo;
- proteção para impedir que `DEMO_MODE` envie eventos para adapters de produção.

Implemente adapters:

`BlingGateway`
`ApChatGateway`
`MercadoLivreGateway`

com implementações reais e fake/mock.

O ambiente demo deve usar exclusivamente adapters fake.

## Segurança

Trate tokens OAuth e client secrets como segredos.

Requisitos:

- nunca versionar segredos;
- `.env.example`;
- validação de variáveis de ambiente;
- criptografia de tokens sensíveis em repouso quando aplicável;
- cookies seguros;
- CSRF quando aplicável;
- proteção de rotas;
- RBAC;
- rate limit;
- audit log;
- mascaramento de dados sensíveis em logs;
- proteção contra SSRF ao baixar arquivos externos;
- validação rigorosa de uploads;
- limites de tamanho;
- timeouts em HTTP;
- não registrar access_token/refresh_token completos.

## Bling

A integração Bling é crítica.

Preserve:

- OAuth;
- refresh token;
- expiração;
- revogação;
- tratamento de 401;
- tratamento de `invalid_grant`;
- rate limiting;
- concorrência no refresh;
- retry;
- idempotência;
- paginação;
- sincronização por período;
- obtenção de NF-e;
- contatos;
- boletos;
- PDF;
- XML;
- rastreamento;
- demais endpoints realmente usados no legado.

Substitua locks locais de arquivo por mecanismo seguro em ambiente distribuído, preferencialmente Redis lock ou PostgreSQL advisory lock.

Garanta que dois workers nunca façam refresh concorrente do mesmo token.

## Jobs e filas

Converta rotinas de crontab e sincronizações demoradas em jobs observáveis.

Cada job deve possuir:

- tenant;
- tipo;
- payload;
- status;
- tentativas;
- timestamps;
- erro resumido;
- correlação;
- idempotency key quando aplicável.

Use:

- BullMQ;
- Redis;
- retry exponencial;
- jitter;
- timeout;
- dead-letter/falhas permanentes;
- locks;
- rate limiting por integração/tenant.

Crie uma tela administrativa de jobs/sincronizações com:

- em execução;
- concluído;
- falhou;
- duração;
- tentativa;
- mensagem;
- opção segura de reprocessamento.

## Regras fiscais e financeiras

Não “simplifique” cálculos existentes.

Extraia-os para funções de domínio testáveis.

Antes de portar cada cálculo:

1. localize a implementação PHP;
2. liste entradas;
3. liste consultas;
4. liste arredondamentos;
5. liste tratamento de NULL;
6. liste casos especiais;
7. crie fixtures;
8. execute o legado quando possível;
9. registre o resultado esperado;
10. implemente o equivalente TypeScript;
11. compare resultados.

Especial atenção para:

- impostos;
- DIFAL;
- créditos;
- taxas;
- frete;
- desconto;
- custo total;
- custo líquido;
- venda líquida;
- lucro;
- margem;
- itens sem lucro;
- lucro negativo/zerado;
- status derivados desses resultados.

Não altere precisão decimal inadvertidamente.

Use uma estratégia segura para dinheiro/decimais.

## UI/UX

Não copie a aparência do Adianti.

Preserve a funcionalidade, mas crie uma UI moderna de SaaS.

Direção:

- sidebar;
- topbar;
- breadcrumbs;
- dashboards;
- cards;
- tabelas densas mas legíveis;
- filtros;
- busca;
- paginação;
- ordenação;
- exportação;
- badges de status;
- formulários claros;
- feedback de loading;
- empty states;
- erros úteis;
- responsivo;
- dark mode opcional;
- acessibilidade.

As telas devem privilegiar produtividade administrativa.

## Estratégia obrigatória de migração

### Fase 0 — Segurança e baseline

- confira `git status`;
- crie documentação de baseline;
- não altere produção;
- identifique segredos versionados e documente a remoção;
- descubra como o legado inicia;
- descubra como conecta ao PostgreSQL;
- descubra comandos existentes;
- tente executar o legado localmente se viável.

Crie:
`docs/legacy-runtime.md`

### Fase 1 — Arqueologia do legado

Varra:

- `app/control`
- `app/model`
- `app/service`
- `app/routes`
- `app/database`
- `app/config`
- callbacks;
- arquivos de cron;
- scripts CLI;
- SQL;
- menus;
- composer;
- qualquer código customizado em meio ao framework.

Separe:

- código do Adianti;
- código do MadBuilder;
- código gerado;
- código customizado;
- regra de negócio;
- integração;
- infraestrutura.

Crie:

- `docs/legacy-inventory.md`
- `docs/feature-matrix.md`
- `docs/integration-map.md`
- `docs/jobs-map.md`
- `docs/database-map.md`

A feature matrix deve ter:

| Área | Recurso legado | Arquivo legado | Regra de negócio | Banco | Integração | Nova implementação | Teste de paridade | Status |

### Fase 2 — Golden Master / paridade

Antes de grandes substituições, crie fixtures e testes de caracterização.

Para funções puras, capture entradas/saídas.

Para integrações, grave exemplos sanitizados de requests/responses ou crie fixtures equivalentes.

Para banco, crie dataset local de teste.

Crie testes que descrevam o comportamento atual, inclusive comportamentos estranhos que sejam funcionalmente relevantes.

### Fase 3 — Fundação moderna

Crie o monorepo e infraestrutura.

Entregáveis mínimos:

- TypeScript strict;
- ESLint;
- Prettier;
- env validation;
- PostgreSQL;
- Prisma;
- Redis;
- Next;
- API;
- Worker;
- Docker Compose;
- health checks;
- logging estruturado;
- autenticação;
- tenant context;
- CI local.

O comando abaixo, ou equivalente, deve levantar o ambiente:
`docker compose up`

E os comandos de desenvolvimento devem ser simples:
`pnpm dev`
`pnpm test`
`pnpm lint`
`pnpm typecheck`

### Fase 4 — Migração vertical por domínio

Não migre “todas as models” e só depois “todas as telas”.

Migre fatias verticais completas.

Ordem sugerida:

1. tenant + usuários + permissões;
2. configurações + credenciais;
3. Bling OAuth;
4. produtos/pessoas/canais;
5. sincronização de NF-e;
6. XML/PDF;
7. boletos;
8. rastreio;
9. APChat/envios;
10. cálculo fiscal/financeiro;
11. dashboards;
12. metas;
13. custos;
14. relatórios;
15. recursos secundários identificados no inventário.

Para cada domínio:

- mapear legado;
- criar contratos;
- criar serviço;
- criar persistência;
- criar endpoints;
- criar UI;
- criar testes;
- atualizar feature matrix;
- provar paridade.

### Fase 5 — SaaS e demo

Implemente:

- onboarding;
- criação de organização;
- usuário administrador;
- credenciais por tenant;
- feature flags;
- demo tenant;
- seed;
- branding básico;
- auditoria.

Não implemente cobrança real se não houver requisito explícito, mas deixe a arquitetura preparada para planos e assinatura futuramente.

### Fase 6 — Cutover

Somente considerar o legado substituível quando:

- feature matrix estiver essencialmente completa;
- integrações críticas possuírem testes;
- cálculos possuírem testes;
- jobs estiverem observáveis;
- demo funcionar;
- dados estiverem isolados;
- build estiver verde;
- smoke tests estiverem verdes;
- existir plano de rollback.

Crie:

- `docs/parity-report.md`
- `docs/cutover-plan.md`
- `docs/rollback-plan.md`
- `docs/deployment.md`

## Testes

Use no mínimo:

- unit tests para domínio;
- integration tests para PostgreSQL;
- integration tests para Redis/jobs;
- contract tests para gateways;
- Playwright para fluxos críticos.

Fluxos E2E mínimos:

1. login;
2. troca/seleção de organização;
3. cadastro/configuração de integração;
4. OAuth Bling em mock;
5. sincronização de notas;
6. visualização de NF-e;
7. processamento de XML;
8. cálculo;
9. boleto/rastreio;
10. envio APChat em mock;
11. dashboard;
12. ambiente demo.

## Observabilidade

Use logs estruturados.

Inclua:

- request id;
- job id;
- tenant id;
- integração;
- duração;
- resultado.

Crie health endpoints para:

- web;
- API;
- PostgreSQL;
- Redis;
- worker.

## Qualidade

Não aceite:

- `any` desnecessário;
- arquivos gigantes quando podem ser modularizados;
- regra de negócio dentro de componente React;
- acesso direto a Prisma espalhado pela UI;
- tokens em logs;
- jobs sem retry;
- chamadas HTTP sem timeout;
- código “temporário” sem rastreamento;
- TODOs usados como substitutos para funcionalidade legada;
- mocks sendo utilizados em produção;
- migrations destrutivas silenciosas.

## Registro contínuo da execução

Crie `MIGRATION_STATUS.md`.

Atualize continuamente com:

- fase atual;
- módulos descobertos;
- módulos migrados;
- testes;
- riscos;
- bloqueios;
- próximos itens.

Não use o documento como desculpa para apenas planejar. A missão é IMPLEMENTAR.

## Definition of Done

A migração só está concluída quando:

- o produto moderno inicia do zero com documentação;
- banco PostgreSQL funciona;
- worker funciona;
- Redis funciona;
- autenticação funciona;
- multi-tenancy funciona;
- tenant demo funciona;
- integrações reais estão implementadas ou bloqueadas apenas por credenciais;
- mocks existem para demonstração/testes;
- fluxo de sincronização funciona;
- NF-e funciona;
- XML/PDF funciona;
- boleto/rastreio funciona;
- APChat funciona;
- cálculos relevantes têm paridade comprovada;
- dashboards principais existem;
- permissões funcionam;
- jobs e logs são observáveis;
- os testes críticos estão verdes;
- não há segredos no código;
- Docker Compose levanta o ambiente;
- documentação de deploy/cutover existe.

## Forma de trabalhar

Comece imediatamente pela inspeção completa do repositório.

Não tente me impressionar criando UI antes de entender o sistema.

Primeiro descubra o que existe.
Depois crie testes de caracterização.
Depois construa a fundação.
Depois migre verticalmente.

Quando encontrar código legado ruim, não replique a implementação ruim, mas preserve o comportamento correto.

Quando encontrar comportamento possivelmente bugado:

- documente;
- crie teste demonstrando;
- preserve temporariamente se mudar quebrar compatibilidade;
- marque como candidato a correção posterior.

Priorize funcionalidade, segurança e paridade sobre velocidade cosmética.

Use as skills existentes em `.agents/skills` sempre que forem relevantes.

Agora comece a execução e continue autonomamente até atingir o máximo de migração funcional possível nesta sessão.
