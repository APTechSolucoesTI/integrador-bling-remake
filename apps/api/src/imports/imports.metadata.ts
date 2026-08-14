import type {
  CsvImportEntity,
  CsvImportMetadataResponse,
  ModulePermission,
} from "@integrador/contracts";

type Field = CsvImportMetadataResponse["entities"][number]["fields"][number];

const field = (
  key: string,
  label: string,
  type: Field["type"],
  required = false,
  aliases: string[] = [],
  description: string | null = null,
): Field => ({ key, label, type, required, aliases, description });

const externalId = field(
  "externalId",
  "ID no Bling / legado",
  "text",
  true,
  ["id", "id_bling", "idbling", "external_id", "codigo_bling"],
  "Chave usada para atualizar sem duplicar registros.",
);
const active = field("active", "Ativo", "boolean", false, [
  "situacao",
  "ativo",
  "status",
]);

export const CSV_IMPORT_ENTITIES: CsvImportMetadataResponse["entities"] = [
  {
    key: "product-groups",
    label: "Grupos de produtos",
    description: "Grupos fiscais/comerciais e marcação de fabricação própria.",
    permission: "products:manage",
    fields: [
      externalId,
      field("name", "Nome", "text", true, ["nome", "descricao"]),
      field("ownManufacture", "Fabricação própria", "boolean", false, [
        "fp",
        "fabricacao_propria",
        "own_manufacture",
      ]),
    ],
  },
  {
    key: "products",
    label: "Produtos",
    description: "Catálogo, custos, NCM e vínculo com grupo.",
    permission: "products:manage",
    fields: [
      externalId,
      field("sku", "Código / SKU", "text", false, ["codigo", "cod", "sku"]),
      field("name", "Nome", "text", true, ["nome", "descricao_produto"]),
      field("description", "Descrição", "text", false, [
        "descricao",
        "observacao",
      ]),
      field("ncm", "NCM", "text", false, ["classificacao_fiscal"]),
      field("cost", "Custo", "number", false, [
        "custo",
        "preco_custo",
        "valor_custo",
      ]),
      field("groupExternalId", "ID do grupo", "text", false, [
        "grupo_id",
        "grupo_produto_id",
        "id_grupo",
      ]),
      field("groupName", "Nome do grupo", "text", false, [
        "grupo",
        "grupo_produto",
      ]),
      active,
      field("ownManufacture", "Fabricação própria", "boolean", false, [
        "fp",
        "fabricacao_propria",
      ]),
      field("monophase", "Monofásico", "boolean", false, [
        "monofasico",
        "monophase",
      ]),
    ],
  },
  {
    key: "contacts",
    label: "Pessoas / clientes",
    description: "Contatos e endereço principal.",
    permission: "people:manage",
    fields: [
      externalId,
      field("name", "Nome", "text", true, ["nome", "razao_social", "cliente"]),
      field("document", "CPF / CNPJ", "text", false, [
        "documento",
        "numero_documento",
        "cpf",
        "cnpj",
      ]),
      field("stateRegistration", "Inscrição estadual", "text", false, [
        "ie",
        "inscricao_estadual",
      ]),
      field("identityDocument", "RG", "text", false, ["rg"]),
      field("phone", "Telefone", "text", false, ["telefone"]),
      field("mobile", "Celular", "text", false, ["celular", "whatsapp"]),
      field("email", "E-mail", "email", false, ["mail"]),
      field("messagingDisabled", "Desabilitar mensagens", "boolean", false, [
        "desabilitar_envio",
        "bloquear_envio",
      ]),
      field("street", "Endereço", "text", false, ["endereco", "logradouro"]),
      field("number", "Número", "text", false, ["numero_endereco"]),
      field("complement", "Complemento", "text", false, ["complemento"]),
      field("district", "Bairro", "text", false, ["bairro"]),
      field("postalCode", "CEP", "text", false, ["cep"]),
      field("city", "Cidade", "text", false, ["cidade", "municipio"]),
      field("state", "UF", "text", false, ["estado", "uf"]),
    ],
  },
  {
    key: "sellers",
    label: "Vendedores",
    description: "Vendedores e vínculo opcional com setor.",
    permission: "commercial:manage",
    fields: [
      externalId,
      field("name", "Nome", "text", true, ["nome", "vendedor"]),
      field("sectorName", "Setor", "text", false, ["setor", "departamento"]),
      active,
    ],
  },
  {
    key: "sales-channels",
    label: "Canais de venda",
    description: "Lojas, marketplaces e origens comerciais.",
    permission: "commercial:manage",
    fields: [
      externalId,
      field("description", "Descrição", "text", true, [
        "descricao",
        "nome",
        "canal",
      ]),
      field("type", "Tipo", "text", false, ["tipo", "origem"]),
      active,
    ],
  },
  {
    key: "payment-methods",
    label: "Formas de pagamento",
    description: "Formas e tipos de pagamento usados pelo Bling.",
    permission: "commercial:manage",
    fields: [
      externalId,
      field("description", "Descrição", "text", true, ["descricao", "nome"]),
      field("paymentType", "Tipo de pagamento", "text", false, [
        "tipo_pagamento",
        "tipo",
      ]),
      active,
    ],
  },
  {
    key: "operation-natures",
    label: "Naturezas de operação",
    description: "Naturezas fiscais usadas na elegibilidade das NF-e.",
    permission: "commercial:manage",
    fields: [
      externalId,
      field("description", "Descrição", "text", true, [
        "descricao",
        "nome",
        "natureza",
      ]),
      active,
    ],
  },
  {
    key: "sales-orders",
    label: "Pedidos de venda",
    description: "Pedidos, comissão e frete de marketplace.",
    permission: "commercial:manage",
    fields: [
      externalId,
      field("number", "Número", "number", false, ["numero", "numero_pedido"]),
      field("issuedAt", "Data", "date", false, ["data", "data_emissao"]),
      field("total", "Valor", "number", false, ["valor", "valor_total"]),
      field("statusCode", "Situação", "number", false, ["situacao", "status"]),
      field("discount", "Desconto", "number", false, ["desconto"]),
      field("invoiceExternalId", "ID da NF-e", "text", false, [
        "nfe_id_bling",
        "id_nfe",
      ]),
      field("commission", "Comissão", "number", false, [
        "taxa_comissao",
        "comissao",
      ]),
      field("shippingCost", "Custo do frete", "number", false, [
        "custo_frete",
        "frete",
      ]),
    ],
  },
  {
    key: "invoices",
    label: "NF-e",
    description:
      "Cabeçalhos de notas. Itens podem ser importados na etapa própria.",
    permission: "nfe:manage",
    fields: [
      externalId,
      field("number", "Número", "text", true, ["numero", "numero_nf"]),
      field("statusCode", "Situação", "number", true, ["situacao", "status"]),
      field("issuedAt", "Emissão", "datetime", false, ["data_emissao", "data"]),
      field("direction", "Tipo", "number", false, ["tipo"]),
      field("series", "Série", "number", false, ["serie"]),
      field("accessKey", "Chave de acesso", "text", false, [
        "chave_acesso",
        "chave",
      ]),
      field("contactExternalId", "ID do cliente", "text", false, [
        "contato_id_bling",
        "cliente_id",
      ]),
      field("sellerExternalId", "ID do vendedor", "text", false, [
        "vendedor_id",
      ]),
      field("channelExternalId", "ID do canal", "text", false, [
        "loja_id",
        "canal_id",
      ]),
      field("natureExternalId", "ID da natureza", "text", false, [
        "natureza_operacao_id",
        "natureza_id",
      ]),
      field("total", "Valor total", "number", false, ["valor", "valor_total"]),
      field("xmlUrl", "Link XML", "text", false, ["link_xml", "xml"]),
      field("pdfUrl", "Link PDF", "text", false, ["link_pdf", "pdf"]),
    ],
  },
  {
    key: "invoice-items",
    label: "Itens de NF-e",
    description: "Itens históricos, quantidades, valores e custos brutos.",
    permission: "nfe:manage",
    fields: [
      field("invoiceExternalId", "ID da NF-e", "text", true, [
        "nfe_id_bling",
        "id_nfe",
      ]),
      field("line", "Item", "number", true, ["n_item", "item"]),
      field("productExternalId", "ID do produto", "text", false, [
        "id_produto",
        "produto_id",
      ]),
      field("description", "Descrição", "text", false, [
        "descricao",
        "produto",
      ]),
      field("cfop", "CFOP", "text", false, ["cfop"]),
      field("quantity", "Quantidade", "number", false, ["qnt", "quantidade"]),
      field("saleTotal", "Venda total", "number", false, [
        "venda_total",
        "valor_total",
      ]),
      field("saleUnit", "Venda unitária", "number", false, [
        "venda_unitario",
        "valor_unitario",
      ]),
      field("costTotal", "Custo total", "number", false, ["custo_total"]),
      field("costUnit", "Custo unitário", "number", false, ["custo_unitario"]),
      field("freight", "Frete", "number", false, ["frete"]),
      field("discount", "Desconto", "number", false, ["desconto"]),
      field("otherExpenses", "Outras despesas", "number", false, [
        "outras_despesas",
        "voutro",
      ]),
    ],
  },
  {
    key: "bills",
    label: "Boletos / contas a receber",
    description: "Parcelas e links de boleto vinculados à NF-e.",
    permission: "nfe:manage",
    fields: [
      field("invoiceExternalId", "ID da NF-e", "text", true, [
        "nfe_id_bling",
        "id_nfe",
      ]),
      field("accountExternalId", "ID da conta", "text", true, [
        "conta_id",
        "id_conta",
      ]),
      field("externalNumber", "Número externo", "text", false, [
        "numero_externo",
      ]),
      field("dueAt", "Vencimento", "date", false, ["vencimento"]),
      field("amount", "Valor", "number", false, ["valor"]),
      field("statusCode", "Situação", "number", false, ["situacao", "status"]),
      field("url", "Link boleto", "text", false, ["link_boleto", "url"]),
    ],
  },
  {
    key: "tracking-codes",
    label: "Rastreamentos",
    description: "Códigos de rastreio vinculados às NF-e.",
    permission: "nfe:manage",
    fields: [
      field("invoiceExternalId", "ID da NF-e", "text", true, [
        "nfe_id_bling",
        "id_nfe",
      ]),
      field("code", "Código", "text", true, [
        "codigo",
        "codigo_rastreio",
        "rastreio",
      ]),
      field("carrier", "Transportadora", "text", false, ["transportadora"]),
      field("trackingUrl", "Link", "text", false, ["url", "link_rastreio"]),
    ],
  },
];

export const CSV_IMPORT_BY_ENTITY = new Map<
  CsvImportEntity,
  (typeof CSV_IMPORT_ENTITIES)[number]
>(CSV_IMPORT_ENTITIES.map((entity) => [entity.key, entity]));

export function importPermission(entity: CsvImportEntity): ModulePermission {
  return CSV_IMPORT_BY_ENTITY.get(entity)!.permission;
}
