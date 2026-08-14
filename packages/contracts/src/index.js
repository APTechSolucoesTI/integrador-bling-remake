import { z } from "zod";
export const modulePermissionSchema = z.enum([
  "dashboard:view",
  "nfe:view",
  "nfe:manage",
  "products:view",
  "products:manage",
  "people:view",
  "people:manage",
  "documents:view",
  "commercial:view",
  "commercial:manage",
  "goals:view",
  "goals:manage",
  "finance:view",
  "marketplace-fees:view",
  "costs:view",
  "costs:manage",
  "tax:view",
  "tax:manage",
  "integrations:manage",
  "operations:view",
  "operations:manage",
  "settings:view",
  "settings:manage",
  "users:manage",
]);
export const ALL_MODULE_PERMISSIONS = modulePermissionSchema.options;
export const tenantSessionSchema = z.object({
  userId: z.uuid(),
  activeTenantId: z.uuid(),
  allowedTenantIds: z.array(z.uuid()).min(1),
  permissions: z.array(modulePermissionSchema),
  demo: z.boolean(),
});
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(10).max(128),
});
export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    superAdmin: z.boolean(),
  }),
  tenant: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    demo: z.boolean(),
  }),
  accessProfile: z.object({ id: z.uuid(), name: z.string() }),
  permissions: z.array(modulePermissionSchema),
  availableTenants: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      demo: z.boolean(),
      accessProfile: z.object({ id: z.uuid(), name: z.string() }),
      permissions: z.array(modulePermissionSchema),
    }),
  ),
  expiresAt: z.iso.datetime(),
});
const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/);
export const dashboardSummarySchema = z.object({
  source: z.literal("product-postgresql"),
  tenant: z.object({ id: z.uuid(), name: z.string(), demo: z.boolean() }),
  period: z.object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    months: z.number().int(),
  }),
  metrics: z.object({
    grossRevenue: moneySchema,
    netRevenue: moneySchema,
    cost: moneySchema,
    tax: moneySchema,
    profit: moneySchema,
    marginPercent: z.string().regex(/^-?\d+\.\d{2}$/),
    invoiceCount: z.number().int().nonnegative(),
  }),
  months: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      label: z.string(),
      grossRevenue: moneySchema,
      profit: moneySchema,
      cost: moneySchema,
    }),
  ),
  recentInvoices: z.array(
    z.object({
      number: z.string(),
      issuedAt: z.iso.datetime(),
      customerName: z.string(),
      channel: z.string(),
      value: moneySchema,
      status: z.string(),
      hasBoleto: z.boolean(),
      hasTracking: z.boolean(),
    }),
  ),
  analytics: z.object({
    calculation: z.object({
      success: z.number().int().nonnegative(),
      inconsistent: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      unprocessed: z.number().int().nonnegative(),
    }),
    channels: z.array(
      z.object({
        label: z.string(),
        revenue: moneySchema,
        profit: moneySchema,
        invoices: z.number().int().nonnegative(),
      }),
    ),
    vendors: z.array(
      z.object({
        label: z.string(),
        revenue: moneySchema,
        profit: moneySchema,
        invoices: z.number().int().nonnegative(),
      }),
    ),
    products: z.array(
      z.object({
        name: z.string(),
        quantity: z.string(),
        revenue: moneySchema,
        profit: moneySchema,
      }),
    ),
    documents: z.object({
      boletos: z.number().int().nonnegative(),
      tracking: z.number().int().nonnegative(),
      pendingSurvey: z.number().int().nonnegative(),
    }),
  }),
});
const optionalQueryText = (max) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().trim().max(max).optional(),
  );
export const nfeListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    numero: optionalQueryText(50),
    serie: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.coerce.number().int().optional(),
    ),
    nome: optionalQueryText(160),
    envio: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.enum(["S", "N"]).optional(),
    ),
    valor: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z
        .string()
        .trim()
        .regex(/^\d+(?:[.,]\d{1,2})?$/)
        .transform((value) => value.replace(",", "."))
        .optional(),
    ),
    dataInicial: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.iso.date().optional(),
    ),
    dataFinal: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.iso.date().optional(),
    ),
    temCodigo: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.enum(["S", "N"]).optional(),
    ),
    statusEnvio: optionalQueryText(50),
    statusId: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    order: z
      .enum(["data_emissao", "numero", "nome", "valor"])
      .default("data_emissao"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    ({ dataInicial, dataFinal }) =>
      !dataInicial || !dataFinal || dataInicial <= dataFinal,
    {
      message: "Data inicial deve ser anterior à data final",
      path: ["dataFinal"],
    },
  );
const nfeStatusCountSchema = z.object({
  statusId: z.number().int().nullable(),
  label: z.string(),
  count: z.number().int().nonnegative(),
});
export const nfeListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      blingId: z.string(),
      numero: z.string(),
      serie: z.number().int().nullable(),
      nome: z.string(),
      envioDesabilitado: z.boolean(),
      valor: moneySchema,
      dataEmissao: z.iso.date().nullable(),
      linkPdf: z.string().nullable(),
      codigoRastreio: z.string().nullable(),
      statusEnvio: z.string(),
      statusId: z.number().int().nullable(),
      observacaoEnvio: z.string().nullable(),
      temBoleto: z.boolean(),
      temCodigo: z.boolean(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
  statusCounts: z.array(nfeStatusCountSchema),
});
export const nfeDetailResponseSchema = z.object({
  invoice: z.object({
    id: z.number().int().positive(),
    blingId: z.string(),
    numero: z.string(),
    serie: z.number().int().nullable(),
    chaveAcesso: z.string().nullable(),
    naturezaOperacao: z.string().nullable(),
    dataEmissao: z.iso.date().nullable(),
    cliente: z.string(),
    vendedor: z.string().nullable(),
    canalVenda: z.string().nullable(),
    statusEnvio: z.string(),
    observacaoEnvio: z.string().nullable(),
    linkXml: z.string().nullable(),
    linkPdf: z.string().nullable(),
    codigoRastreio: z.string().nullable(),
    codigoRastreio2: z.string().nullable(),
    dataEnvio: z.iso.datetime().nullable(),
    calculo: z.string().nullable(),
    observacaoCalculo: z.string().nullable(),
    valor: moneySchema,
    vendaLiquida: moneySchema,
    custoLiquido: moneySchema,
    impostos: moneySchema,
    frete: moneySchema,
    desconto: moneySchema,
    taxa: moneySchema,
    outrasDespesas: moneySchema,
    creditoIpi: moneySchema,
    creditoIcms: moneySchema,
    lucro: moneySchema,
    margemLucro: z.string().regex(/^-?\d+\.\d{2}$/),
  }),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      item: z.number().int().nullable(),
      produtoId: z.string().nullable(),
      nome: z.string(),
      codigo: z.string().nullable(),
      cfop: z.number().int().nullable(),
      quantidade: z.string(),
      vendaLiquida: moneySchema,
      custoLiquido: moneySchema,
      impostos: moneySchema,
      lucro: moneySchema,
      margemLucro: z.string().regex(/^-?\d+\.\d{2}$/),
      creditoIpi: moneySchema,
      creditoIcms: moneySchema,
      inconsistencia: z.string().nullable(),
    }),
  ),
  boletos: z.array(
    z.object({
      id: z.number().int().positive(),
      numeroExterno: z.string().nullable(),
      vencimento: z.iso.date().nullable(),
      valor: moneySchema,
      situacao: z.number().int().nullable(),
      link: z.string().nullable(),
    }),
  ),
});
export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  idProduto: optionalQueryText(100),
  nome: optionalQueryText(200),
  codigo: optionalQueryText(100),
  fabricacaoPropria: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(["S", "N"]).optional(),
  ),
  order: z
    .enum(["id_produto", "nome", "codigo", "custo"])
    .default("id_produto"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export const productListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      blingId: z.string().nullable(),
      nome: z.string(),
      codigo: z.string().nullable(),
      descricao: z.string().nullable(),
      ncm: z.string().nullable(),
      custo: moneySchema.nullable(),
      situacao: z.string().nullable(),
      fabricacaoPropria: z.boolean().nullable(),
      atualizadoEm: z.iso.datetime().nullable(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export const peopleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: optionalQueryText(200),
  envioDesabilitado: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(["S", "N"]).optional(),
  ),
  order: z.enum(["nome", "id_bling"]).default("nome"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export const peopleListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      blingId: z.string(),
      nome: z.string(),
      documento: z.string().nullable(),
      inscricaoEstadual: z.string().nullable(),
      telefone: z.string().nullable(),
      celular: z.string().nullable(),
      email: z.string().nullable(),
      envioDesabilitado: z.boolean(),
      endereco: z
        .object({
          logradouro: z.string().nullable(),
          numero: z.string().nullable(),
          bairro: z.string().nullable(),
          cep: z.string().nullable(),
          municipio: z.string().nullable(),
          uf: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export const peopleMessagingUpdateSchema = z.object({ disabled: z.boolean() });
export const goalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  competencia: optionalQueryText(100),
  dataInicial: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.iso.date().optional(),
  ),
  dataFinal: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.iso.date().optional(),
  ),
  statusId: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
});
export const goalListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      competencia: z.string().nullable(),
      dataInicial: z.iso.date().nullable(),
      dataFinal: z.iso.date().nullable(),
      statusId: z.number().int().positive(),
      status: z.string(),
      valorMetaVendedores: moneySchema,
      valorMetaSetores: moneySchema,
      custoPlanejado: moneySchema,
      vendedores: z.number().int().nonnegative(),
      setores: z.number().int().nonnegative(),
      custos: z.number().int().nonnegative(),
    }),
  ),
  statusCounts: z.array(
    z.object({
      statusId: z.number().int().positive(),
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
const goalTargetSchema = z.object({
  id: z.number().int().positive(),
  value: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  commissionType: z.enum(["P", "R"]).nullable(),
  commission: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});
export const goalResourcesResponseSchema = z.object({
  vendors: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string(),
      sector: z.string().nullable(),
    }),
  ),
  sectors: z.array(
    z.object({ id: z.number().int().positive(), name: z.string() }),
  ),
});
export const goalCreateInputSchema = z
  .object({
    competencia: z.string().trim().min(4).max(20),
    dataInicial: z.iso.date(),
    dataFinal: z.iso.date(),
    vendors: z.array(goalTargetSchema),
    sectors: z.array(goalTargetSchema),
    costs: z.array(
      z.object({
        description: z.string().trim().min(2).max(255),
        value: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
      }),
    ),
  })
  .refine((value) => value.dataInicial <= value.dataFinal, {
    path: ["dataFinal"],
    message: "Período inválido",
  })
  .refine(
    (value) =>
      new Set(value.vendors.map((item) => item.id)).size ===
      value.vendors.length,
    { message: "Vendedor duplicado" },
  )
  .refine(
    (value) =>
      new Set(value.sectors.map((item) => item.id)).size ===
      value.sectors.length,
    { message: "Setor duplicado" },
  );
export const operationsOverviewSchema = z.object({
  integrations: z.array(
    z.object({
      kind: z.enum(["bling", "apchat", "mercado_livre"]),
      configured: z.boolean(),
      enabled: z.boolean(),
      status: z.string(),
      updatedAt: z.iso.datetime().nullable(),
      detail: z.string().nullable(),
    }),
  ),
  jobs: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      status: z.enum(["queued", "active", "completed", "failed", "cancelled"]),
      attempt: z.number().int().nonnegative(),
      createdAt: z.iso.datetime(),
      finishedAt: z.iso.datetime().nullable(),
      errorMessage: z.string().nullable(),
    }),
  ),
  legacyLogs: z.array(
    z.object({
      id: z.number().int().positive(),
      source: z.string(),
      method: z.string(),
      status: z.number().int(),
      message: z.string(),
      occurredAt: z.iso.datetime(),
    }),
  ),
  auditLogs: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  configuration: z.object({
    authorization: z.object({ bling: z.boolean(), mercadoLivre: z.boolean() }),
    schedule: z.object({
      hours: z.array(z.number().int().min(0).max(23)),
      description: z.string().nullable(),
    }),
    apchat: z.object({
      configured: z.boolean(),
      uuid: z.string().nullable(),
      sendNumber: z.string().nullable(),
      reportNumber: z.string().nullable(),
      testNumber: z.string().nullable(),
      messagesOpen: z.boolean(),
    }),
    satisfaction: z.object({
      enabled: z.boolean(),
      daysAfterShipping: z.number().int().min(0).max(20),
      hour: z.number().int().min(0).max(23).nullable(),
      link: z.string().nullable(),
      message: z.string().nullable(),
    }),
  }),
});
export const operationsSettingsUpdateSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("schedule"),
      hours: z.array(z.number().int().min(0).max(23)).max(24),
    }),
    z.object({
      kind: z.literal("apchat"),
      uuid: z.string().trim().min(1).max(200),
      token: z.string().trim().min(1).max(4000).optional(),
      sendNumber: z.string().trim().max(20).nullable(),
      reportNumber: z.string().trim().max(20).nullable(),
      testNumber: z.string().trim().max(20).nullable(),
      messagesOpen: z.boolean(),
    }),
    z.object({
      kind: z.literal("satisfaction"),
      enabled: z.boolean(),
      daysAfterShipping: z.number().int().min(0).max(20),
      hour: z.number().int().min(0).max(23).nullable(),
      link: z.string().trim().max(255).nullable(),
      message: z.string().trim().max(10000).nullable(),
    }),
  ])
  .refine(
    (value) =>
      value.kind !== "satisfaction" ||
      !value.enabled ||
      (value.hour !== null && Boolean(value.link) && Boolean(value.message)),
    {
      message: "Pesquisa habilitada exige horário, link e mensagem",
    },
  );
export const oauthAuthorizationResponseSchema = z.object({
  kind: z.enum(["bling", "mercado_livre"]),
  url: z.url(),
});
export const operationsJobRequestSchema = z
  .discriminatedUnion("jobType", [
    z.object({
      jobType: z.literal("bling.sync-nfe"),
      from: z.iso.date(),
      to: z.iso.date(),
    }),
    z.object({
      jobType: z.literal("bling.sync-products"),
    }),
    z.object({
      jobType: z.literal("bling.sync-sales-orders"),
      from: z.iso.date(),
      to: z.iso.date(),
    }),
    z.object({
      jobType: z.literal("apchat.deliver"),
      recipient: z.string().trim().min(8).max(20),
      body: z.string().trim().min(1).max(10_000),
    }),
  ])
  .refine(
    (value) =>
      (value.jobType !== "bling.sync-nfe" &&
        value.jobType !== "bling.sync-sales-orders") ||
      value.from <= value.to,
    {
      path: ["to"],
      message: "Período inválido",
    },
  );
export const queuedJobResponseSchema = z.object({
  id: z.uuid(),
  correlationId: z.uuid(),
  jobType: z.enum([
    "bling.sync-nfe",
    "bling.sync-products",
    "bling.sync-sales-orders",
    "apchat.deliver",
  ]),
  status: z.literal("queued"),
});
export const marketplaceFeeResponseSchema = z.object({
  orderId: z.string().regex(/^\d+$/),
  fee: moneySchema,
});
export const nfeSyncResponseSchema = z.object({
  id: z.uuid(),
  correlationId: z.uuid(),
  jobType: z.literal("nfe.sync-details"),
  status: z.literal("queued"),
});
export const profitabilityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  numero: optionalQueryText(50),
  nome: optionalQueryText(200),
  tipoVenda: optionalQueryText(100),
  dataInicial: z.iso.date(),
  dataFinal: z.iso.date(),
  calculo: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(["S", "I", "N"]).optional(),
  ),
  somentePrejuizo: z.preprocess(
    (value) => (value === "true" || value === true ? true : false),
    z.boolean(),
  ),
});
export const profitabilityResponseSchema = z.object({
  summary: z.object({
    vendaBruta: moneySchema,
    vendaLiquida: moneySchema,
    custoLiquido: moneySchema,
    impostos: moneySchema,
    lucro: moneySchema,
    margemSobreVendaLiquida: z.string().regex(/^-?\d+\.\d{2}$/),
    notas: z.number().int().nonnegative(),
  }),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      numero: z.string(),
      tipoVenda: z.string(),
      dataEmissao: z.iso.date().nullable(),
      nome: z.string(),
      valor: moneySchema,
      vendaLiquida: moneySchema,
      desconto: moneySchema,
      frete: moneySchema,
      outrasDespesas: moneySchema,
      custoLiquido: moneySchema,
      impostos: moneySchema,
      taxa: moneySchema,
      lucro: moneySchema,
      margemLucro: z.string().regex(/^-?\d+\.\d{2}$/),
      calculo: z.string().nullable(),
      observacao: z.string().nullable(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export const adminUsersResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.email(),
      active: z.boolean(),
      joinedAt: z.iso.datetime(),
      permissions: z.array(modulePermissionSchema),
      accessProfileId: z.uuid(),
      accessProfileName: z.string(),
    }),
  ),
  counts: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    administrators: z.number().int().nonnegative(),
  }),
});
export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(10).max(128),
  accessProfileId: z.uuid(),
});
export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
    password: z.string().min(10).max(128).optional(),
    active: z.boolean().optional(),
    accessProfileId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.password !== undefined ||
      value.active !== undefined ||
      value.accessProfileId !== undefined,
  );
export const tenantSettingsResponseSchema = z.object({
  organization: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    brandName: z.string().nullable(),
    legacyUnitId: z.number().int().positive().nullable(),
    taxRegime: z.string().nullable(),
  }),
  preferences: z.object({
    zoom: z.number().int().min(50).max(150),
    fixedMenu: z.boolean(),
  }),
  featureFlags: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
});
export const tenantSettingsUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  brandName: z.string().trim().max(120).nullable().optional(),
  taxRegime: z
    .enum(["Simples Nacional", "Lucro Presumido"])
    .nullable()
    .optional(),
  zoom: z.number().int().min(50).max(150).optional(),
  fixedMenu: z.boolean().optional(),
});
export const organizationsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      legacyUnitId: z.number().int().positive().nullable(),
      name: z.string(),
      slug: z.string(),
      brandName: z.string().nullable(),
      active: z.boolean(),
      demo: z.boolean(),
      members: z.number().int().nonnegative(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  brandName: z.string().trim().max(120).nullable(),
  legacyUnitId: z.number().int().positive().nullable(),
});
export const businessOverviewResponseSchema = z.object({
  documents: z.object({
    boletos: z.array(
      z.object({
        id: z.number().int().positive(),
        invoiceId: z.number().int().positive().nullable(),
        invoiceNumber: z.string().nullable(),
        customer: z.string(),
        externalNumber: z.string().nullable(),
        dueDate: z.iso.date().nullable(),
        value: moneySchema,
        status: z.number().int().nullable(),
        link: z.string().nullable(),
      }),
    ),
    tracking: z.array(
      z.object({
        invoiceId: z.number().int().positive(),
        invoiceNumber: z.string(),
        customer: z.string(),
        issuedAt: z.iso.date().nullable(),
        sentAt: z.iso.datetime().nullable(),
        primaryCode: z.string().nullable(),
        secondaryCode: z.string().nullable(),
        status: z.string(),
      }),
    ),
  }),
  commercial: z.object({
    vendors: z.array(
      z.object({
        id: z.number().int().positive(),
        blingId: z.string().nullable(),
        name: z.string(),
        sector: z.string().nullable(),
      }),
    ),
    channels: z.array(
      z.object({
        id: z.number().int().positive(),
        storeId: z.string().nullable(),
        description: z.string(),
        type: z.string().nullable(),
      }),
    ),
    paymentMethods: z.array(
      z.object({
        id: z.number().int().positive(),
        blingId: z.string().nullable(),
        description: z.string(),
        type: z.string().nullable(),
      }),
    ),
    productGroups: z.array(
      z.object({
        id: z.number().int().positive(),
        blingId: z.string().nullable(),
        name: z.string(),
      }),
    ),
    operationNatures: z.array(
      z.object({
        id: z.number().int().positive(),
        blingId: z.string().nullable(),
        description: z.string(),
      }),
    ),
  }),
  fiscal: z.object({
    fixedCostTypes: z.array(
      z.object({ id: z.number().int().positive(), label: z.string() }),
    ),
    fixedCosts: z.array(
      z.object({
        id: z.number().int().positive(),
        name: z.string(),
        description: z.string().nullable(),
        value: moneySchema,
        application: z.enum(["Item", "Nota"]),
        valueType: z.enum(["F", "P"]),
        categoryId: z.number().int().positive().nullable(),
        category: z.string().nullable(),
        channelIds: z.array(z.number().int().positive()),
      }),
    ),
    taxRules: z.array(
      z.object({
        id: z.number().int().positive(),
        name: z.string(),
        simulationRate: z.string().regex(/^-?\d+\.\d{2}$/),
      }),
    ),
    difal: z.array(
      z.object({
        id: z.number().int().positive(),
        state: z.string().length(2),
        internalRate: z.string().regex(/^-?\d+\.\d{2}$/),
      }),
    ),
  }),
});
export const fixedCostInputSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(155).nullable(),
  value: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/),
  application: z.enum(["Item", "Nota"]),
  valueType: z.enum(["F", "P"]),
  categoryId: z.number().int().positive().nullable(),
  channelIds: z.array(z.number().int().positive()),
});
export const integrationJobSchema = z.object({
  tenantId: z.uuid(),
  jobType: z.enum([
    "bling.sync-nfe",
    "bling.sync-products",
    "bling.sync-sales-orders",
    "bling.refresh-token",
    "nfe.sync-details",
    "nfe.process-xml",
    "apchat.deliver",
    "goals.process-expired",
  ]),
  correlationId: z.uuid(),
  requestedBy: z.uuid().optional(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export const runtimeEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DEMO_TENANT_ID: z.uuid(),
});
