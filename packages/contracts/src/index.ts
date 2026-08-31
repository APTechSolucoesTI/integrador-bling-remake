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
  "imports:manage",
  "settings:view",
  "settings:manage",
  "users:manage",
]);
export type ModulePermission = z.infer<typeof modulePermissionSchema>;
export const ALL_MODULE_PERMISSIONS = modulePermissionSchema.options;

export const tenantSessionSchema = z.object({
  userId: z.uuid(),
  activeTenantId: z.uuid(),
  allowedTenantIds: z.array(z.uuid()).min(1),
  permissions: z.array(modulePermissionSchema),
  demo: z.boolean(),
});
export type TenantSession = z.infer<typeof tenantSessionSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(10).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const masterKeyLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12).max(256),
});
export type MasterKeyLoginRequest = z.infer<typeof masterKeyLoginRequestSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "A nova senha deve ser diferente",
  });
export type PasswordChange = z.infer<typeof passwordChangeSchema>;

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
  masterKeyAccess: z.boolean(),
  preferences: z.object({
    zoom: z.number().int().min(50).max(150),
    fixedMenu: z.boolean(),
  }),
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
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const userPreferencesUpdateSchema = z
  .object({
    zoom: z.number().int().min(50).max(150).optional(),
    fixedMenu: z.boolean().optional(),
  })
  .refine(
    (value) => value.zoom !== undefined || value.fixedMenu !== undefined,
    "Informe ao menos uma preferência",
  );
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>;

export const notificationSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  level: z.enum(["info", "success", "warning", "error"]),
  title: z.string(),
  message: z.string(),
  detail: z.record(z.string(), z.unknown()),
  actionHref: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  read: z.boolean(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListResponseSchema = z.object({
  unread: z.number().int().nonnegative(),
  items: z.array(notificationSchema),
});
export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});
export const globalSearchResultSchema = z.object({
  query: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        "invoice-operational",
        "invoice-financial",
        "person",
        "product",
      ]),
      category: z.string(),
      title: z.string(),
      subtitle: z.string(),
      href: z.string(),
    }),
  ),
});
export type GlobalSearchResult = z.infer<typeof globalSearchResultSchema>;

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
    customers: z.array(
      z.object({
        label: z.string(),
        revenue: moneySchema,
        profit: moneySchema,
        averageTicket: moneySchema,
        invoices: z.number().int().nonnegative(),
      }),
    ),
    dailyRevenue: z.object({
      median: moneySchema,
      points: z.array(
        z.object({
          date: z.iso.date(),
          revenue: moneySchema,
          invoices: z.number().int().nonnegative(),
        }),
      ),
    }),
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
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const dashboardExecutiveQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  origin: z.string().trim().max(120).optional(),
  product: z.string().trim().max(180).optional(),
  productCode: z.string().trim().max(80).optional(),
  productGroup: z.string().trim().max(180).optional(),
  monthCompetence: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  goalCompetence: z.string().trim().max(30).optional(),
});
export type DashboardExecutiveQuery = z.infer<
  typeof dashboardExecutiveQuerySchema
>;
const executiveGroupSchema = z.object({
  label: z.string(),
  revenue: moneySchema,
  profit: moneySchema,
  cost: moneySchema,
  invoices: z.number().int().nonnegative(),
  averageTicket: moneySchema,
  averageProfit: moneySchema,
});
const executivePeriodSchema = z.object({
  key: z.string(),
  label: z.string(),
  revenue: moneySchema,
  cost: moneySchema,
  profit: moneySchema,
  invoices: z.number().int().nonnegative(),
});
const costAnalysisSchema = z.object({
  total: moneySchema,
  quantity: z.string(),
  invoices: z.number().int().nonnegative(),
  periods: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      cost: moneySchema,
      invoices: z.number().int().nonnegative(),
    }),
  ),
  origins: z.array(
    z.object({
      label: z.string(),
      cost: moneySchema,
      invoices: z.number().int().nonnegative(),
    }),
  ),
  products: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      group: z.string(),
      competence: z.string().regex(/^\d{4}-\d{2}$/),
      revenue: moneySchema,
      totalCost: moneySchema,
      cost: moneySchema,
      quantity: z.string(),
      invoices: z.number().int().nonnegative(),
    }),
  ),
});
const manufacturingGroupSchema = z.object({
  label: z.string(),
  revenue: moneySchema,
  cost: moneySchema,
  profit: moneySchema,
  invoices: z.number().int().nonnegative(),
});
const manufacturingAnalysisSchema = z.object({
  metrics: z.object({
    revenue: moneySchema,
    cost: moneySchema,
    profit: moneySchema,
    margin: z.string().regex(/^-?\d+\.\d{2}$/),
    quantity: z.string(),
    invoices: z.number().int().nonnegative(),
  }),
  periods: z.array(executivePeriodSchema),
  origins: z.array(manufacturingGroupSchema),
  groups: z.array(manufacturingGroupSchema),
  products: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      group: z.string(),
      competence: z.string().regex(/^\d{4}-\d{2}$/),
      revenue: moneySchema,
      grossCost: moneySchema,
      cost: moneySchema,
      credits: moneySchema,
      profit: moneySchema,
      margin: z.string().regex(/^-?\d+\.\d{2}$/),
      quantity: z.string(),
      invoices: z.number().int().nonnegative(),
    }),
  ),
});
export const dashboardExecutiveSchema = z.object({
  filters: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    origins: z.array(z.string()),
    products: z.array(z.string()),
    productCodes: z.array(z.string()),
    productGroups: z.array(z.string()),
    months: z.array(z.string()),
    goalCompetences: z.array(z.string()),
    company: z.string(),
  }),
  metrics: z.object({
    revenue: moneySchema,
    netRevenue: moneySchema,
    cost: moneySchema,
    tax: moneySchema,
    fees: moneySchema,
    freight: moneySchema,
    otherExpenses: moneySchema,
    profit: moneySchema,
    margin: z.string().regex(/^-?\d+\.\d{2}$/),
    invoices: z.number().int().nonnegative(),
  }),
  origins: z.array(executiveGroupSchema),
  companies: z.array(executiveGroupSchema),
  periods: z.array(executivePeriodSchema),
  daily: z.array(
    z.object({
      date: z.iso.date(),
      revenue: moneySchema,
      average: moneySchema,
      cumulativeRevenue: moneySchema,
      profit: moneySchema,
      cumulativeProfit: moneySchema,
    }),
  ),
  customers: z.array(
    z.object({
      name: z.string(),
      revenue: moneySchema,
      profit: moneySchema,
      invoices: z.number().int(),
    }),
  ),
  products: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      origin: z.string(),
      month: z.string(),
      quantity: z.string(),
      revenue: moneySchema,
      netRevenue: moneySchema,
      tax: moneySchema,
      cost: moneySchema,
      profit: moneySchema,
      margin: z.string().regex(/^-?\d+\.\d{2}$/),
      invoices: z.number().int(),
    }),
  ),
  goal: z.object({
    competence: z.string().nullable(),
    cost: moneySchema,
    points: z.array(
      z.object({
        date: z.iso.date(),
        cumulativeProfit: moneySchema,
        goalCost: moneySchema,
        balance: moneySchema,
        reached: z.string().regex(/^-?\d+\.\d{2}$/),
      }),
    ),
  }),
  states: z.array(
    z.object({
      state: z.string(),
      revenue: moneySchema,
      invoices: z.number().int(),
    }),
  ),
  cmv: costAnalysisSchema,
  manufacturing: manufacturingAnalysisSchema,
});
export type DashboardExecutive = z.infer<typeof dashboardExecutiveSchema>;

export const dashboardInvoiceReportQuerySchema =
  dashboardExecutiveQuerySchema.extend({
    view: z
      .enum(["revenue", "profit", "products", "state", "cmv", "manufacturing"])
      .optional(),
    state: z.string().trim().length(2).optional(),
    customer: z.string().trim().max(180).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  });
export type DashboardInvoiceReportQuery = z.infer<
  typeof dashboardInvoiceReportQuerySchema
>;
export const dashboardInvoiceReportSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      number: z.string(),
      company: z.string(),
      customer: z.string(),
      issuedAt: z.iso.date().nullable(),
      origin: z.string(),
      state: z.string().nullable(),
      revenue: moneySchema,
      netRevenue: moneySchema,
      cost: moneySchema,
      tax: moneySchema,
      fees: moneySchema,
      freight: moneySchema,
      otherExpenses: moneySchema,
      profit: moneySchema,
      margin: z.string().regex(/^-?\d+\.\d{2}$/),
      quantity: z.string(),
      cmv: moneySchema,
      manufacturingRevenue: moneySchema,
      manufacturingCost: moneySchema,
      manufacturingProfit: moneySchema,
      manufacturingMargin: z.string().regex(/^-?\d+\.\d{2}$/),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export type DashboardInvoiceReport = z.infer<
  typeof dashboardInvoiceReportSchema
>;

const optionalQueryText = (max: number) =>
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
    tipoVenda: optionalQueryText(100),
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
export type NfeListQuery = z.infer<typeof nfeListQuerySchema>;

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
export type NfeListResponse = z.infer<typeof nfeListResponseSchema>;

export const invoiceFilterOptionsResponseSchema = z.object({
  customers: z.array(z.string()),
  salesChannels: z.array(z.string()),
});
export type InvoiceFilterOptionsResponse = z.infer<
  typeof invoiceFilterOptionsResponseSchema
>;

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
      cfop: z.string().nullable(),
      quantidade: z.string(),
      desconto: moneySchema,
      frete: moneySchema,
      outrasDespesas: moneySchema,
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
  contact: z
    .object({
      id: z.number().int().positive(),
      blingId: z.string(),
      name: z.string(),
      documentNumber: z.string().nullable(),
      stateRegistration: z.string().nullable(),
      identityDocument: z.string().nullable(),
      phone: z.string().nullable(),
      contactPhone: z.string().nullable(),
      mobilePhone: z.string().nullable(),
      email: z.string().nullable(),
      messagingDisabled: z.boolean(),
      address: z
        .object({
          street: z.string().nullable(),
          number: z.string().nullable(),
          complement: z.string().nullable(),
          district: z.string().nullable(),
          postalCode: z.string().nullable(),
          city: z.string().nullable(),
          state: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
  financialBreakdown: z
    .object({
      costs: z.object({
        productCost: moneySchema,
        additions: z.array(
          z.object({
            label: z.string(),
            value: moneySchema,
            rate: z.string().nullable(),
            items: z.number().int().nonnegative(),
          }),
        ),
        credits: z.array(
          z.object({
            label: z.string(),
            value: moneySchema,
            rate: z.string().nullable(),
            items: z.number().int().nonnegative(),
          }),
        ),
        adjustment: moneySchema,
        total: moneySchema,
      }),
      taxes: z.object({
        items: z.array(
          z.object({
            label: z.string(),
            value: moneySchema,
            rate: z.string().nullable(),
            baseValue: moneySchema.nullable(),
            cst: z.string().nullable(),
            items: z.number().int().nonnegative(),
          }),
        ),
        adjustment: moneySchema,
        total: moneySchema,
      }),
      fees: z.object({
        items: z.array(
          z.object({
            label: z.string(),
            value: moneySchema,
            rate: z.string().nullable(),
            items: z.number().int().nonnegative(),
          }),
        ),
        adjustment: moneySchema,
        total: moneySchema,
      }),
      profit: z.object({
        revenue: moneySchema,
        deductions: z.array(
          z.object({ label: z.string(), value: moneySchema }),
        ),
        total: moneySchema,
      }),
    })
    .nullable(),
});
export type NfeDetailResponse = z.infer<typeof nfeDetailResponseSchema>;

export const nfeContactUpdateInputSchema = z.object({
  mobilePhone: z
    .string()
    .trim()
    .max(25)
    .refine(
      (value) => value.length === 0 || value.replace(/\D/g, "").length >= 10,
      "Informe um celular com DDD",
    ),
  messagingDisabled: z.boolean(),
});
export type NfeContactUpdateInput = z.infer<typeof nfeContactUpdateInputSchema>;

export const nfeItemNormalizationInputSchema = z.object({
  productId: z.number().int().positive(),
});
export type NfeItemNormalizationInput = z.infer<
  typeof nfeItemNormalizationInputSchema
>;

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalQueryText(200),
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
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

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
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

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
export type PeopleListQuery = z.infer<typeof peopleListQuerySchema>;

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
export type PeopleListResponse = z.infer<typeof peopleListResponseSchema>;
export const peopleMessagingUpdateSchema = z.object({ disabled: z.boolean() });
export type PeopleMessagingUpdate = z.infer<typeof peopleMessagingUpdateSchema>;

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
export type GoalListQuery = z.infer<typeof goalListQuerySchema>;

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
export type GoalListResponse = z.infer<typeof goalListResponseSchema>;

const goalTargetSchema = z.object({
  id: z.number().int().positive(),
  value: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  commissionType: z.enum(["P", "R"]).nullable(),
  commission: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});
export const goalResourcesResponseSchema = z.object({
  competences: z.array(z.string()),
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
export type GoalResourcesResponse = z.infer<typeof goalResourcesResponseSchema>;
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
export type GoalCreateInput = z.infer<typeof goalCreateInputSchema>;

export const goalDetailResponseSchema = z
  .object({
    id: z.number().int().positive(),
    statusId: z.number().int().positive(),
  })
  .and(goalCreateInputSchema);
export type GoalDetailResponse = z.infer<typeof goalDetailResponseSchema>;

const nfePolicyStringListSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(500);

export const nfeSyncPolicySchema = z
  .object({
    enabled: z.boolean(),
    allowedStatuses: z
      .array(
        z
          .number()
          .int()
          .refine((value) => [2, 5, 6].includes(value)),
      )
      .min(1)
      .max(3),
    allowedDirections: z
      .array(
        z
          .number()
          .int()
          .refine((value) => [0, 1].includes(value)),
      )
      .min(1)
      .max(2),
    requireSaleNature: z.boolean(),
    excludeReturnNature: z.boolean(),
    includedNatureIds: nfePolicyStringListSchema,
    excludedNatureIds: nfePolicyStringListSchema,
    includedCustomerIds: nfePolicyStringListSchema,
    excludedCustomerIds: nfePolicyStringListSchema,
    includedCustomerDocuments: nfePolicyStringListSchema,
    excludedCustomerDocuments: nfePolicyStringListSchema,
    includedCustomerTerms: nfePolicyStringListSchema,
    excludedCustomerTerms: nfePolicyStringListSchema,
    includedSalesChannelIds: nfePolicyStringListSchema,
    excludedSalesChannelIds: nfePolicyStringListSchema,
    includedSellerIds: nfePolicyStringListSchema,
    excludedSellerIds: nfePolicyStringListSchema,
    includedCfops: nfePolicyStringListSchema,
    excludedCfops: nfePolicyStringListSchema,
    includedSkus: nfePolicyStringListSchema,
    excludedSkus: nfePolicyStringListSchema,
    includedNcms: nfePolicyStringListSchema,
    excludedNcms: nfePolicyStringListSchema,
    minimumTotal: z.number().nonnegative().nullable(),
    maximumTotal: z.number().nonnegative().nullable(),
  })
  .refine(
    (value) =>
      value.minimumTotal === null ||
      value.maximumTotal === null ||
      value.minimumTotal <= value.maximumTotal,
    {
      path: ["maximumTotal"],
      message: "Valor máximo deve ser maior que o mínimo",
    },
  );
export type NfeSyncPolicy = z.infer<typeof nfeSyncPolicySchema>;

const nfePolicyOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  detail: z.string().nullable().optional(),
});

export const nfeSyncPolicyOptionsSchema = z.object({
  natures: z.array(nfePolicyOptionSchema),
  salesChannels: z.array(nfePolicyOptionSchema),
  sellers: z.array(nfePolicyOptionSchema),
  customers: z.array(nfePolicyOptionSchema),
  products: z.array(nfePolicyOptionSchema),
  cfops: z.array(z.string()),
  ncms: z.array(z.string()),
});
export type NfeSyncPolicyOptions = z.infer<typeof nfeSyncPolicyOptionsSchema>;

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
    bling: z.object({
      credentialsConfigured: z.boolean(),
      clientIdHint: z.string().nullable(),
      connected: z.boolean(),
      expiresAt: z.iso.datetime().nullable(),
      lastError: z.string().nullable(),
    }),
    schedule: z.object({
      enabled: z.boolean(),
      autoDeliver: z.boolean(),
      hours: z.array(z.number().int().min(0).max(23)),
      description: z.string().nullable(),
    }),
    apchat: z.object({
      configured: z.boolean(),
      enabled: z.boolean(),
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
    nfeSyncPolicy: nfeSyncPolicySchema,
    nfeSyncOptions: nfeSyncPolicyOptionsSchema,
  }),
});
export type OperationsOverview = z.infer<typeof operationsOverviewSchema>;

export const operationsSettingsUpdateSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("schedule"),
      enabled: z.boolean(),
      autoDeliver: z.boolean(),
      hours: z.array(z.number().int().min(0).max(23)).max(24),
    }),
    z
      .object({
        kind: z.literal("blingCredentials"),
        clientId: z.string().trim().min(1).max(500).optional(),
        clientSecret: z.string().trim().min(1).max(4000).optional(),
      })
      .refine(
        (value) =>
          value.clientId !== undefined || value.clientSecret !== undefined,
        "Informe ao menos uma credencial",
      ),
    z.object({
      kind: z.literal("apchat"),
      enabled: z.boolean(),
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
    nfeSyncPolicySchema.extend({ kind: z.literal("nfeSyncPolicy") }),
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
export type OperationsSettingsUpdate = z.infer<
  typeof operationsSettingsUpdateSchema
>;
export const oauthAuthorizationResponseSchema = z.object({
  kind: z.enum(["bling", "mercado_livre"]),
  url: z.url(),
});
export type OauthAuthorizationResponse = z.infer<
  typeof oauthAuthorizationResponseSchema
>;

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
      jobType: z.literal("bling.sync-payment-methods"),
    }),
    z.object({
      jobType: z.literal("bling.sync-sales-channels"),
    }),
    z.object({
      jobType: z.literal("bling.sync-sellers"),
    }),
    z.object({
      jobType: z.literal("bling.sync-operation-natures"),
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
export type OperationsJobRequest = z.infer<typeof operationsJobRequestSchema>;

export const queuedJobResponseSchema = z.object({
  id: z.uuid(),
  correlationId: z.uuid(),
  jobType: z.enum([
    "bling.sync-nfe",
    "bling.sync-products",
    "bling.sync-payment-methods",
    "bling.sync-sales-channels",
    "bling.sync-sellers",
    "bling.sync-operation-natures",
    "bling.sync-sales-orders",
    "apchat.deliver",
  ]),
  status: z.literal("queued"),
});
export type QueuedJobResponse = z.infer<typeof queuedJobResponseSchema>;

export const marketplaceFeeResponseSchema = z.object({
  orderId: z.string().regex(/^\d+$/),
  fee: moneySchema,
});
export type MarketplaceFeeResponse = z.infer<
  typeof marketplaceFeeResponseSchema
>;

export const nfeSyncResponseSchema = z.object({
  id: z.uuid(),
  correlationId: z.uuid(),
  jobType: z.enum([
    "nfe.sync-details",
    "nfe.deliver",
    "nfe.process-xml",
    "contact.update",
  ]),
  status: z.literal("queued"),
});
export type NfeSyncResponse = z.infer<typeof nfeSyncResponseSchema>;

export const nfeBulkActionRequestSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(50),
});
export type NfeBulkActionRequest = z.infer<typeof nfeBulkActionRequestSchema>;

export const nfeBulkActionResponseSchema = z.object({
  queued: z.array(nfeSyncResponseSchema),
  skipped: z.array(
    z.object({
      id: z.number().int().positive(),
      reason: z.string(),
    }),
  ),
});
export type NfeBulkActionResponse = z.infer<typeof nfeBulkActionResponseSchema>;

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
export type ProfitabilityQuery = z.infer<typeof profitabilityQuerySchema>;

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
export type ProfitabilityResponse = z.infer<typeof profitabilityResponseSchema>;

export const marketplaceFeesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    invoiceNumber: optionalQueryText(50),
    origin: optionalQueryText(120),
    from: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.iso.date().optional(),
    ),
    to: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.iso.date().optional(),
    ),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Período inválido",
  });
export type MarketplaceFeesQuery = z.infer<typeof marketplaceFeesQuerySchema>;

export const marketplaceFeesResponseSchema = z.object({
  tenant: z.object({ id: z.uuid(), name: z.string() }),
  filters: z.object({
    invoiceNumbers: z.array(z.string()),
    origins: z.array(z.string()),
  }),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      invoiceNumber: z.string(),
      company: z.string(),
      origin: z.string(),
      customer: z.string(),
      issuedAt: z.iso.datetime().nullable(),
      value: moneySchema,
      commissionValue: moneySchema,
      commissionPercent: z.string().regex(/^\d+\.\d{2}$/),
      freightValue: moneySchema,
      freightPercent: z.string().regex(/^\d+\.\d{2}$/),
      discountValue: moneySchema,
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export type MarketplaceFeesResponse = z.infer<
  typeof marketplaceFeesResponseSchema
>;

export const marketplaceFeeItemsResponseSchema = z.object({
  invoiceId: z.number().int().positive(),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      productId: z.string().nullable(),
      code: z.string().nullable(),
      description: z.string(),
      quantity: z.string(),
      itemValue: moneySchema,
      unitValue: moneySchema,
      commissionValue: moneySchema,
      commissionPercent: z.string().regex(/^\d+\.\d{2}$/),
      freightValue: moneySchema,
      freightPercent: z.string().regex(/^\d+\.\d{2}$/),
    }),
  ),
});
export type MarketplaceFeeItemsResponse = z.infer<
  typeof marketplaceFeeItemsResponseSchema
>;

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
      tenantIds: z.array(z.uuid()).min(1),
    }),
  ),
  counts: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    administrators: z.number().int().nonnegative(),
  }),
});
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const accessProfileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(modulePermissionSchema),
  assignedUsers: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const accessProfilesResponseSchema = z.object({
  items: z.array(accessProfileSchema),
});
export type AccessProfilesResponse = z.infer<
  typeof accessProfilesResponseSchema
>;

export const accessProfileInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable().optional(),
  permissions: z
    .array(modulePermissionSchema)
    .max(ALL_MODULE_PERMISSIONS.length),
});
export type AccessProfileInput = z.infer<typeof accessProfileInputSchema>;

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(10).max(128),
  accessProfileId: z.uuid(),
  tenantIds: z.array(z.uuid()).min(1),
});
export type AdminCreateUser = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
    password: z.string().min(10).max(128).optional(),
    active: z.boolean().optional(),
    accessProfileId: z.uuid().optional(),
    tenantIds: z.array(z.uuid()).min(1).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.password !== undefined ||
      value.active !== undefined ||
      value.accessProfileId !== undefined ||
      value.tenantIds !== undefined,
  );
export type AdminUpdateUser = z.infer<typeof adminUpdateUserSchema>;

export const tenantSettingsResponseSchema = z.object({
  organization: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    brandName: z.string().nullable(),
    legacyUnitId: z.number().int().positive().nullable(),
    taxRegime: z.enum(["Lucro Presumido", "Simples Nacional"]),
  }),
  preferences: z.object({
    zoom: z.number().int().min(50).max(150),
    fixedMenu: z.boolean(),
  }),
  featureFlags: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
});
export type TenantSettingsResponse = z.infer<
  typeof tenantSettingsResponseSchema
>;

export const tenantSettingsUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  brandName: z.string().trim().max(120).nullable().optional(),
  taxRegime: z.enum(["Lucro Presumido", "Simples Nacional"]).optional(),
  zoom: z.number().int().min(50).max(150).optional(),
  fixedMenu: z.boolean().optional(),
});
export type TenantSettingsUpdate = z.infer<typeof tenantSettingsUpdateSchema>;

export const csvImportEntitySchema = z.enum([
  "product-groups",
  "products",
  "contacts",
  "sellers",
  "sales-channels",
  "payment-methods",
  "operation-natures",
  "sales-orders",
  "invoices",
  "invoice-items",
  "bills",
  "tracking-codes",
]);
export type CsvImportEntity = z.infer<typeof csvImportEntitySchema>;

export const csvImportFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
  type: z.enum(["text", "number", "boolean", "date", "datetime", "email"]),
  aliases: z.array(z.string()),
  description: z.string().nullable(),
});
export const csvImportMetadataResponseSchema = z.object({
  entities: z.array(
    z.object({
      key: csvImportEntitySchema,
      label: z.string(),
      description: z.string(),
      permission: modulePermissionSchema,
      fields: z.array(csvImportFieldSchema),
    }),
  ),
});
export type CsvImportMetadataResponse = z.infer<
  typeof csvImportMetadataResponseSchema
>;

export const csvImportExecuteSchema = z.object({
  entity: csvImportEntitySchema,
  rows: z
    .array(z.record(z.string(), z.string().max(10_000)))
    .min(1)
    .max(250),
});
export type CsvImportExecute = z.infer<typeof csvImportExecuteSchema>;
export const csvImportResultSchema = z.object({
  entity: csvImportEntitySchema,
  processed: z.number().int().nonnegative(),
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(
    z.object({ row: z.number().int().positive(), message: z.string() }),
  ),
});
export type CsvImportResult = z.infer<typeof csvImportResultSchema>;

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
export type OrganizationsResponse = z.infer<typeof organizationsResponseSchema>;
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
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

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
    sectors: z.array(
      z.object({
        id: z.number().int().positive(),
        name: z.string(),
        active: z.boolean(),
        sellers: z.number().int().nonnegative(),
      }),
    ),
    vendors: z.array(
      z.object({
        id: z.number().int().positive(),
        blingId: z.string().nullable(),
        name: z.string(),
        sectorId: z.number().int().positive().nullable(),
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
    salesOrders: z.array(
      z.object({
        id: z.number().int().positive(),
        blingId: z.string(),
        number: z.number().int().nullable(),
        issuedAt: z.iso.date().nullable(),
        total: moneySchema,
        statusCode: z.number().int().nullable(),
        invoiceBlingId: z.string().nullable(),
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
    ncmCredits: z.array(
      z.object({
        id: z.number().int().positive(),
        ncm: z.string(),
        rate: z.string().regex(/^-?\d+\.\d{2}$/),
        reduction: z.string().regex(/^-?\d+\.\d{2}$/),
      }),
    ),
  }),
});

export const sectorInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  active: z.boolean().default(true),
  sellerIds: z.array(z.number().int().positive()).max(500).default([]),
});
export type SectorInput = z.infer<typeof sectorInputSchema>;
export type BusinessOverviewResponse = z.infer<
  typeof businessOverviewResponseSchema
>;

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
export type FixedCostInput = z.infer<typeof fixedCostInputSchema>;

export const fixedCostDuplicateInputSchema = z.object({
  targetTenantIds: z.array(z.uuid()).min(1).max(100),
});
export type FixedCostDuplicateInput = z.infer<
  typeof fixedCostDuplicateInputSchema
>;

export const fixedCostDuplicateResponseSchema = z.object({
  sourceCostId: z.number().int().positive(),
  results: z.array(
    z.object({
      tenantId: z.uuid(),
      tenantName: z.string(),
      status: z.enum(["created", "updated"]),
      matchedChannels: z.number().int().nonnegative(),
      missingChannels: z.array(z.string()),
    }),
  ),
});
export type FixedCostDuplicateResponse = z.infer<
  typeof fixedCostDuplicateResponseSchema
>;

export const ncmCreditInputSchema = z.object({
  ncm: z
    .string()
    .trim()
    .regex(/^\d{8}$/),
  rate: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,4})?$/),
  reduction: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,4})?$/),
});
export type NcmCreditInput = z.infer<typeof ncmCreditInputSchema>;

export const integrationJobSchema = z.object({
  tenantId: z.uuid(),
  jobType: z.enum([
    "bling.sync-daily-integrity",
    "bling.sync-nfe",
    "bling.sync-cancelled-nfe",
    "bling.sync-products",
    "bling.sync-payment-methods",
    "bling.sync-sales-channels",
    "bling.sync-sellers",
    "bling.sync-operation-natures",
    "bling.sync-sales-orders",
    "bling.refresh-token",
    "nfe.sync-details",
    "nfe.deliver",
    "nfe.process-xml",
    "contact.update",
    "apchat.deliver",
    "satisfaction.deliver",
    "goals.process-expired",
  ]),
  correlationId: z.uuid(),
  requestedBy: z.uuid().optional(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type IntegrationJob = z.infer<typeof integrationJobSchema>;

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
export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
