# Status da migração

Atualizado em: 2026-08-10

## Direção atual

Conclusão funcional do produto APBling. Testes adicionais, E2E e validações de segurança foram conscientemente postergados para a próxima etapa a pedido do responsável pelo projeto.

## Produto já implementado

- Landing pública APBling, login do produto real e demonstração pública direta em `/demo`.
- Demo totalmente frontend, sem autenticação, PostgreSQL ou integração externa, com mocks manipuláveis em `localStorage`.
- Aplicação autenticada com dashboard analítico, seleção de período e pesquisa global.
- Sessão persistida, papéis `owner/admin/operator/viewer`, troca autorizada de empresa e tenant obtido exclusivamente no servidor.
- Control plane multiempresa, tela de organizações para superadmin e bootstrap idempotente do primeiro proprietário.
- Administração de usuários, papéis, status, identidade da empresa, regime tributário e preferências.
- Listagem e detalhe de NF-e com itens, memória financeira persistida, XML/PDF, boletos e rastreios.
- Catálogos reais de produtos e pessoas, incluindo endereço principal e preferência de comunicação.
- Hub de documentos, cadastros comerciais, custos/tributação, lucro/margem e metas.
- CRUD tenant-aware de custos fixos/variáveis e associações de canais.
- Criação, cancelamento e finalização de metas com as regras de duplicação do `MetaService.php`.
- Configuração operacional de horários, APChat, pesquisa de satisfação e links de autorização.
- Monitor unificado de BullMQ, `saas_audit_log` e `log_crontab`.
- Sincronização manual de NF-e enfileirada: API registra a execução, BullMQ processa, Bling v3 é paginado e o PostgreSQL recebe upsert de NF-e, pessoas e endereços.
- Enriquecimento individual de NF-e pelo worker com links XML/PDF, contato, boletos e até dois códigos de rastreio, sem recalcular os valores fiscais persistidos.
- Sincronização produtiva de grupos de fabricação própria, produtos e pedidos de venda do Bling, com paginação, detalhes, atualização incremental e persistência nas tabelas legadas por unidade.
- OAuth moderno completo de Bling e Mercado Livre: geração de `state`, callback server-to-server, persistência dos tokens por unidade e redirecionamento ao painel.
- APChat produtivo enfileirado, com credenciais por empresa, número de homologação e confirmação de aceite no monitor operacional.
- Consulta autenticada de tarifas de pedidos do Mercado Livre, incluindo renovação coordenada do token.
- Worker com retry/backoff, atualização de tentativa/estado e deduplicação das situações 5/6 por número.
- Monorepo Next.js/NestJS/BullMQ/Prisma/Zod preservando integralmente `legacy/`.

## Dependências externas ainda necessárias para fechar a paridade integral

- Credenciais reais de Bling, APChat e Mercado Livre por empresa para homologação externa.
- PostgreSQL legado real ou clone sanitizado para confirmar diferenças do DDL em produção.
- Download e parser moderno do conteúdo XML, itens fiscais e recomposição tributária/financeira; os links, boletos e rastreios já são adquiridos pelo processor moderno.
- Orquestração automática de todas as recorrências do crontab legado e automação completa da pesquisa de satisfação por APChat.
- Execução do PHP legado para gerar golden masters fiscais/financeiros.

## Empacotamento executado neste checkpoint

- Dependências restauradas com o lockfile congelado e política de supply chain do pnpm aprovada.
- Prisma Client 7.9.1 regenerado a partir do schema atual.
- Builds TypeScript concluídos para `contracts`, `domain`, `integrations`, `db`, API NestJS e worker BullMQ, incluindo os novos synchronizers produtivos.
- Build de produção do Next.js concluído com 18 rotas geradas e checagem TypeScript integrada.
- Arquivos alterados formatados com Prettier.

## Validações postergadas a pedido do responsável

- Testes unitários e de integração adicionais para os novos fluxos.
- E2E Playwright com PostgreSQL/Redis reais.
- Revisão de segurança, rate limit de login, recuperação de senha/MFA e ensaio de rollback.

A base anterior possuía 35 testes verdes e havia passado lint e smoke visual antes deste novo lote funcional. Esses testes não foram repetidos neste checkpoint; os resultados atuais de build acima cobrem apenas compilação e empacotamento.

## Como provisionar o primeiro acesso

Após aplicar a migration e compilar o monorepo, configure:

```text
APBLING_ADMIN_EMAIL
APBLING_ADMIN_PASSWORD
APBLING_ADMIN_NAME
APBLING_TENANT_NAME
APBLING_TENANT_SLUG
APBLING_LEGACY_UNIT_ID
APBLING_LEGACY_USER_ID
```

Execute `corepack pnpm bootstrap:admin`. O comando é idempotente, ativa o usuário, define-o como superadmin/proprietário e associa o tenant à unidade legada informada.
