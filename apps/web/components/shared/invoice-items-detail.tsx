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

export function FinancialInvoiceItemsDetail({
  items,
  showHeading = true,
  showActions = false,
  canNormalize = false,
  onNormalize,
}: {
  items: FinancialItem[];
  showHeading?: boolean;
  showActions?: boolean;
  canNormalize?: boolean;
  onNormalize?: (item: FinancialItem) => void;
}) {
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
        <table className={`${styles.itemsTable} ${styles.financialTable}`}>
          <colgroup>
            <col className={styles.productColumn} />
            <col />
            <col />
            {showActions ? <col /> : null}
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
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
    <div className={styles.detail}>
      <div className={styles.detailHeading}>
        <div>
          <span>DISTRIBUIÇÃO</span>
          <strong>Itens e taxas da NF-e</strong>
        </div>
        <b>
          {items.length} {items.length === 1 ? "ITEM" : "ITENS"}
        </b>
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>
          Nenhum item encontrado para esta nota.
        </div>
      ) : (
        <table className={`${styles.itemsTable} ${styles.marketplaceTable}`}>
          <colgroup>
            <col className={styles.productColumn} />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>Descrição / SKU</th>
              <th>Qtd.</th>
              <th>Valor do item</th>
              <th>Comissão %</th>
              <th>Comissão R$</th>
              <th>Frete %</th>
              <th>Frete R$</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td data-label="Descrição / SKU">
                  <ProductCell
                    name={item.description}
                    code={item.code}
                    productId={item.productId}
                  />
                </td>
                <td data-label="Quantidade">
                  {decimal.format(Number(item.quantity))}
                </td>
                <td data-label="Valor do item">
                  {currency.format(Number(item.itemValue))}
                </td>
                <td data-label="Comissão %">
                  {decimal.format(Number(item.commissionPercent))}%
                </td>
                <td data-label="Comissão R$">
                  {currency.format(Number(item.commissionValue))}
                </td>
                <td data-label="Frete %">
                  {decimal.format(Number(item.freightPercent))}%
                </td>
                <td data-label="Frete R$">
                  {currency.format(Number(item.freightValue))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
