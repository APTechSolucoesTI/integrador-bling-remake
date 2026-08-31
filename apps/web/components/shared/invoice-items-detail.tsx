import type { NfeDetailResponse } from "@integrador/contracts";
import { AlertTriangle, Link2, PackageSearch } from "lucide-react";
import styles from "./invoice-items-detail.module.css";

type FinancialItem = NfeDetailResponse["items"][number];
export interface MarketplaceDetailItem {
  id: number;
  productId: string | null;
  code: string | null;
  description: string;
  quantity: string;
  itemValue: string;
  commissionValue: string;
  commissionPercent: string;
  freightValue: string;
  freightPercent: string;
}
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

export function blingProductUrl(productId: string) {
  return `https://www.bling.com.br/produtos.php#edit/${encodeURIComponent(productId)}`;
}

function ProductCell({
  name,
  code,
  productId,
  inconsistency,
}: {
  name: string;
  code: string | null;
  productId: string | null;
  inconsistency?: string | null;
}) {
  return (
    <div className={styles.productCell}>
      <div>
        <strong>{name}</strong>
        <small>{code ?? productId ?? "Sem código"}</small>
      </div>
      {productId ? (
        <a
          className={styles.blingLink}
          href={blingProductUrl(productId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${name} no Bling`}
          title="Abrir produto no Bling"
        >
          <PackageSearch size={15} />
        </a>
      ) : null}
      {inconsistency ? (
        <span className={styles.inconsistency}>
          <AlertTriangle size={13} /> {inconsistency}
        </span>
      ) : null}
    </div>
  );
}

function InlineValue({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative" | "expense" | undefined;
}) {
  return (
    <div className={`${styles.inlineValue} ${tone ? styles[tone] : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function FinancialInvoiceItemsDetail({
  items,
  showHeading = true,
  compact = false,
  showActions = false,
  canNormalize = false,
  onNormalize,
}: {
  items: FinancialItem[];
  showHeading?: boolean;
  compact?: boolean;
  showActions?: boolean;
  canNormalize?: boolean;
  onNormalize?: (item: FinancialItem) => void;
}) {
  if (compact)
    return (
      <div className={styles.inlineDetail}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            Nenhum item persistido para esta nota.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`${styles.inlineRow} ${styles.financialInline} ${item.inconsistencia ? styles.inconsistentRow : ""}`}
            >
              <div className={styles.inlineProduct}>
                <span>Item / produto</span>
                <ProductCell
                  name={item.nome}
                  code={item.codigo}
                  productId={item.produtoId}
                  inconsistency={item.inconsistencia}
                />
              </div>
              <InlineValue label="CFOP" value={item.cfop ?? "—"} />
              <InlineValue
                label="Qtd."
                value={decimal.format(Number(item.quantidade))}
              />
              <InlineValue
                label="Desconto"
                value={currency.format(Number(item.desconto))}
              />
              <InlineValue
                label="Frete"
                value={currency.format(Number(item.frete))}
              />
              <InlineValue
                label="Outras despesas"
                value={currency.format(Number(item.outrasDespesas))}
                tone={Number(item.outrasDespesas) > 0 ? "expense" : undefined}
              />
              <InlineValue
                label="Venda líquida"
                value={currency.format(Number(item.vendaLiquida))}
              />
              <InlineValue
                label="Custo líquido"
                value={currency.format(Number(item.custoLiquido))}
              />
              <InlineValue
                label="Impostos"
                value={currency.format(Number(item.impostos))}
                detail={`Créditos: ${currency.format(Number(item.creditoIpi) + Number(item.creditoIcms))}`}
              />
              <InlineValue
                label="Lucro"
                value={currency.format(Number(item.lucro))}
                tone={Number(item.lucro) < 0 ? "negative" : "positive"}
              />
              <InlineValue
                label="Margem"
                value={`${decimal.format(Number(item.margemLucro))}%`}
                tone={Number(item.margemLucro) < 0 ? "negative" : "positive"}
              />
            </div>
          ))
        )}
      </div>
    );

  return (
    <div className={`${styles.detail} ${!showHeading ? styles.embedded : ""}`}>
      {showHeading ? (
        <div className={styles.detailHeading}>
          <div>
            <span>COMPOSIÇÃO</span>
            <strong>Itens da NF-e</strong>
          </div>
          <b>
            {items.length} {items.length === 1 ? "ITEM" : "ITENS"}
          </b>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className={styles.empty}>
          Nenhum item persistido para esta nota.
        </div>
      ) : (
        <table className={styles.itemsTable}>
          <colgroup>
            <col className={styles.productColumn} />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            {showActions ? <col /> : null}
          </colgroup>
          <thead>
            <tr>
              <th>Item / produto</th>
              <th>CFOP</th>
              <th>Qtd.</th>
              <th>Desconto</th>
              <th>Frete</th>
              <th>Outras despesas</th>
              <th>Venda líquida</th>
              <th>Custo líquido</th>
              <th>Impostos</th>
              <th>Lucro</th>
              <th>Margem</th>
              {showActions ? <th>Ação</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={
                  item.inconsistencia ? styles.inconsistentRow : undefined
                }
              >
                <td data-label="Item / produto">
                  <ProductCell
                    name={item.nome}
                    code={item.codigo}
                    productId={item.produtoId}
                    inconsistency={item.inconsistencia}
                  />
                </td>
                <td data-label="CFOP">{item.cfop ?? "—"}</td>
                <td data-label="Quantidade">
                  {decimal.format(Number(item.quantidade))}
                </td>
                <td data-label="Desconto">
                  {currency.format(Number(item.desconto))}
                </td>
                <td data-label="Frete">
                  {currency.format(Number(item.frete))}
                </td>
                <td
                  data-label="Outras despesas"
                  className={
                    Number(item.outrasDespesas) > 0 ? styles.expense : undefined
                  }
                >
                  {currency.format(Number(item.outrasDespesas))}
                </td>
                <td data-label="Venda líquida">
                  {currency.format(Number(item.vendaLiquida))}
                </td>
                <td data-label="Custo líquido">
                  {currency.format(Number(item.custoLiquido))}
                </td>
                <td data-label="Impostos">
                  {currency.format(Number(item.impostos))}
                  <small>
                    Créditos:{" "}
                    {currency.format(
                      Number(item.creditoIpi) + Number(item.creditoIcms),
                    )}
                  </small>
                </td>
                <td
                  data-label="Lucro"
                  className={
                    Number(item.lucro) < 0 ? styles.negative : styles.positive
                  }
                >
                  {currency.format(Number(item.lucro))}
                </td>
                <td
                  data-label="Margem"
                  className={
                    Number(item.margemLucro) < 0
                      ? styles.negative
                      : styles.positive
                  }
                >
                  {decimal.format(Number(item.margemLucro))}%
                </td>
                {showActions ? (
                  <td data-label="Ação">
                    {item.produtoId === null && canNormalize && onNormalize ? (
                      <button
                        className={styles.normalizeButton}
                        type="button"
                        onClick={() => onNormalize(item)}
                      >
                        <Link2 size={13} /> Vincular produto
                      </button>
                    ) : (
                      <span className={styles.linkedProduct}>
                        {item.produtoId ? "Vinculado" : "—"}
                      </span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function MarketplaceInvoiceItemsDetail({
  items,
}: {
  items: MarketplaceDetailItem[];
}) {
  return (
    <div className={styles.inlineDetail}>
      {items.length === 0 ? (
        <div className={styles.empty}>
          Nenhum item encontrado para esta nota.
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className={`${styles.inlineRow} ${styles.marketplaceInline}`}
          >
            <div className={styles.inlineProduct}>
              <span>Descrição / SKU</span>
              <ProductCell
                name={item.description}
                code={item.code}
                productId={item.productId}
              />
            </div>
            <InlineValue
              label="Qtd."
              value={decimal.format(Number(item.quantity))}
            />
            <InlineValue
              label="Valor do item"
              value={currency.format(Number(item.itemValue))}
            />
            <InlineValue
              label="Comissão %"
              value={`${decimal.format(Number(item.commissionPercent))}%`}
            />
            <InlineValue
              label="Comissão R$"
              value={currency.format(Number(item.commissionValue))}
              tone="positive"
            />
            <InlineValue
              label="Frete %"
              value={`${decimal.format(Number(item.freightPercent))}%`}
            />
            <InlineValue
              label="Frete R$"
              value={currency.format(Number(item.freightValue))}
            />
          </div>
        ))
      )}
    </div>
  );
}
