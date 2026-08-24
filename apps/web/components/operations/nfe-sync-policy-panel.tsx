"use client";

import type {
  NfeSyncPolicy,
  NfeSyncPolicyOptions,
  OperationsSettingsUpdate,
} from "@integrador/contracts";
import {
  BadgeDollarSign,
  FileCheck2,
  FileText,
  PackageSearch,
  Plus,
  Save,
  ShieldCheck,
  Store,
  Users,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import styles from "./nfe-sync-policy-panel.module.css";

type Option = NfeSyncPolicyOptions["natures"][number];
type ListField = {
  [Key in keyof NfeSyncPolicy]: NfeSyncPolicy[Key] extends string[]
    ? Key
    : never;
}[keyof NfeSyncPolicy];

export function NfeSyncPolicyPanel({
  initialPolicy,
  options,
  canEdit,
  saving,
  onSave,
}: {
  initialPolicy: NfeSyncPolicy;
  options: NfeSyncPolicyOptions;
  canEdit: boolean;
  saving: boolean;
  onSave: (input: OperationsSettingsUpdate) => Promise<void>;
}) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setPolicy(initialPolicy), [initialPolicy]);
  const ruleCount = useMemo(
    () =>
      Object.values(policy).reduce<number>(
        (total, value) => total + (Array.isArray(value) ? value.length : 0),
        0,
      ),
    [policy],
  );

  function updateList(field: ListField, values: string[]) {
    setPolicy((current) => ({ ...current, [field]: unique(values) }));
  }

  return (
    <section className={styles.panel} id="nfe-sync-policy">
      <header className={styles.header}>
        <span className={styles.headerIcon}>
          <ShieldCheck size={20} />
        </span>
        <div className={styles.headerCopy}>
          <span>REGRAS DE ELEGIBILIDADE</span>
          <h2>O que entra na sincronização de NF-e</h2>
          <p>
            Controle por cliente, natureza, canal, vendedor, valor, CFOP, SKU e
            NCM.
          </p>
        </div>
        <div className={styles.headerStatus}>
          <b className={policy.enabled ? styles.enabled : styles.disabled}>
            {policy.enabled ? "Regras ativas" : "Sem filtros personalizados"}
          </b>
          <small>{ruleCount} valores configurados</small>
        </div>
        <button
          className={styles.expandButton}
          type="button"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Fechar configuração" : "Configurar regras"}
        </button>
      </header>

      {expanded ? (
        <div className={styles.editor}>
          <div className={styles.notice}>
            <FileCheck2 size={17} />
            <div>
              <strong>Exclusão sempre vence inclusão.</strong>
              <span>
                Listas permitidas vazias aceitam qualquer valor. Regras de item
                avaliam o XML antes do cálculo.
              </span>
            </div>
          </div>

          <section className={styles.ruleSection}>
            <SectionTitle
              icon={<FileText />}
              title="Escopo da nota"
              description="Situação, tipo e regra comercial da natureza."
            />
            <label className={styles.masterSwitch}>
              <input
                disabled={!canEdit}
                type="checkbox"
                checked={policy.enabled}
                onChange={(event) =>
                  setPolicy({ ...policy, enabled: event.target.checked })
                }
              />
              <span>
                <strong>Aplicar regras personalizadas</strong>
                <small>
                  Desative para aceitar toda NF-e retornada pelo escopo abaixo.
                </small>
              </span>
            </label>
            <div className={styles.scopeGrid}>
              <CheckboxGroup
                label="Situações consultadas"
                values={policy.allowedStatuses}
                options={[
                  { value: 6, label: "Autorizada" },
                  { value: 5, label: "Pendente" },
                ]}
                disabled={!canEdit}
                onChange={(allowedStatuses) =>
                  setPolicy({ ...policy, allowedStatuses })
                }
              />
              <CheckboxGroup
                label="Tipo da nota"
                values={policy.allowedDirections}
                options={[
                  { value: 1, label: "Saída" },
                  { value: 0, label: "Entrada" },
                ]}
                disabled={!canEdit}
                onChange={(allowedDirections) =>
                  setPolicy({ ...policy, allowedDirections })
                }
              />
              <div className={styles.toggleGroup}>
                <span>Regras legadas</span>
                <Toggle
                  label="Exigir “venda” na natureza"
                  checked={policy.requireSaleNature}
                  disabled={!canEdit || !policy.enabled}
                  onChange={(requireSaleNature) =>
                    setPolicy({ ...policy, requireSaleNature })
                  }
                />
                <Toggle
                  label="Bloquear devoluções"
                  checked={policy.excludeReturnNature}
                  disabled={!canEdit || !policy.enabled}
                  onChange={(excludeReturnNature) =>
                    setPolicy({ ...policy, excludeReturnNature })
                  }
                />
              </div>
              <div className={styles.moneyGroup}>
                <span>Faixa de valor da NF-e</span>
                <div>
                  <NumberField
                    label="Mínimo"
                    value={policy.minimumTotal}
                    disabled={!canEdit || !policy.enabled}
                    onChange={(minimumTotal) =>
                      setPolicy({ ...policy, minimumTotal })
                    }
                  />
                  <NumberField
                    label="Máximo"
                    value={policy.maximumTotal}
                    disabled={!canEdit || !policy.enabled}
                    onChange={(maximumTotal) =>
                      setPolicy({ ...policy, maximumTotal })
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={styles.ruleSection}>
            <SectionTitle
              icon={<Store />}
              title="Natureza, origem e vendedor"
              description="Escolha valores sincronizados ou bloqueados usando os cadastros locais do Bling."
            />
            <div className={styles.pairGrid}>
              <RulePair
                label="Naturezas de operação"
                options={options.natures}
                included={policy.includedNatureIds}
                excluded={policy.excludedNatureIds}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) => updateList("includedNatureIds", value)}
                onExcluded={(value) => updateList("excludedNatureIds", value)}
              />
              <RulePair
                label="Canais / origens"
                options={options.salesChannels}
                included={policy.includedSalesChannelIds}
                excluded={policy.excludedSalesChannelIds}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) =>
                  updateList("includedSalesChannelIds", value)
                }
                onExcluded={(value) =>
                  updateList("excludedSalesChannelIds", value)
                }
              />
              <RulePair
                label="Vendedores"
                options={options.sellers}
                included={policy.includedSellerIds}
                excluded={policy.excludedSellerIds}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) => updateList("includedSellerIds", value)}
                onExcluded={(value) => updateList("excludedSellerIds", value)}
              />
            </div>
          </section>

          <section className={styles.ruleSection}>
            <SectionTitle
              icon={<Users />}
              title="Clientes"
              description="Filtre por cadastro, documento ou trecho do nome sem diferenciar maiúsculas e acentos."
            />
            <div className={styles.pairGrid}>
              <RulePair
                label="Clientes específicos"
                options={options.customers}
                included={policy.includedCustomerIds}
                excluded={policy.excludedCustomerIds}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) => updateList("includedCustomerIds", value)}
                onExcluded={(value) => updateList("excludedCustomerIds", value)}
              />
              <TagRulePair
                label="Trechos do nome"
                included={policy.includedCustomerTerms}
                excluded={policy.excludedCustomerTerms}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) =>
                  updateList("includedCustomerTerms", value)
                }
                onExcluded={(value) =>
                  updateList("excludedCustomerTerms", value)
                }
              />
              <TagRulePair
                label="CPF / CNPJ"
                included={policy.includedCustomerDocuments}
                excluded={policy.excludedCustomerDocuments}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) =>
                  updateList("includedCustomerDocuments", value)
                }
                onExcluded={(value) =>
                  updateList("excludedCustomerDocuments", value)
                }
              />
            </div>
          </section>

          <section className={styles.ruleSection}>
            <SectionTitle
              icon={<PackageSearch />}
              title="Itens da NF-e"
              description="Se qualquer item estiver bloqueado, a nota inteira não entra. Inclusões exigem ao menos um item correspondente."
            />
            <div className={styles.pairGrid}>
              <TagRulePair
                label="CFOP"
                suggestions={options.cfops}
                included={policy.includedCfops}
                excluded={policy.excludedCfops}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) => updateList("includedCfops", value)}
                onExcluded={(value) => updateList("excludedCfops", value)}
              />
              <TagRulePair
                label="SKU"
                suggestions={options.products.map((item) => item.value)}
                included={policy.includedSkus}
                excluded={policy.excludedSkus}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) => updateList("includedSkus", value)}
                onExcluded={(value) => updateList("excludedSkus", value)}
              />
              <TagRulePair
                label="NCM"
                suggestions={options.ncms}
                included={policy.includedNcms}
                excluded={policy.excludedNcms}
                disabled={!canEdit || !policy.enabled}
                onIncluded={(value) => updateList("includedNcms", value)}
                onExcluded={(value) => updateList("excludedNcms", value)}
              />
            </div>
          </section>

          <footer className={styles.footer}>
            <div>
              <BadgeDollarSign size={17} />
              <span>
                <strong>Aplicação imediata</strong>
                <small>
                  Próximas sincronizações e ressincronizações usam esta
                  política.
                </small>
              </span>
            </div>
            <button
              disabled={
                !canEdit ||
                saving ||
                policy.allowedStatuses.length === 0 ||
                policy.allowedDirections.length === 0
              }
              type="button"
              onClick={() => void onSave({ kind: "nfeSyncPolicy", ...policy })}
            >
              <Save size={15} />{" "}
              {saving ? "Salvando..." : "Salvar regras de NF-e"}
            </button>
          </footer>
        </div>
      ) : null}
    </section>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.sectionTitle}>
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </header>
  );
}

function CheckboxGroup({
  label,
  values,
  options,
  disabled,
  onChange,
}: {
  label: string;
  values: number[];
  options: Array<{ value: number; label: string }>;
  disabled: boolean;
  onChange: (values: number[]) => void;
}) {
  return (
    <fieldset className={styles.checkboxGroup}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            disabled={
              disabled || (values.includes(option.value) && values.length === 1)
            }
            type="checkbox"
            checked={values.includes(option.value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...values, option.value].sort()
                  : values.filter((value) => value !== option.value),
              )
            }
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        disabled={disabled}
        type="number"
        min="0"
        step="0.01"
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
      />
    </label>
  );
}

function RulePair({
  label,
  options,
  included,
  excluded,
  disabled,
  onIncluded,
  onExcluded,
}: {
  label: string;
  options: Option[];
  included: string[];
  excluded: string[];
  disabled: boolean;
  onIncluded: (value: string[]) => void;
  onExcluded: (value: string[]) => void;
}) {
  return (
    <article className={styles.ruleCard}>
      <h4>{label}</h4>
      <MultiSelect
        label="Permitir somente"
        tone="allow"
        options={options}
        values={included}
        disabled={disabled}
        onChange={onIncluded}
      />
      <MultiSelect
        label="Nunca sincronizar"
        tone="deny"
        options={options}
        values={excluded}
        disabled={disabled}
        onChange={onExcluded}
      />
    </article>
  );
}

function TagRulePair({
  label,
  suggestions = [],
  included,
  excluded,
  disabled,
  onIncluded,
  onExcluded,
}: {
  label: string;
  suggestions?: string[];
  included: string[];
  excluded: string[];
  disabled: boolean;
  onIncluded: (value: string[]) => void;
  onExcluded: (value: string[]) => void;
}) {
  return (
    <article className={styles.ruleCard}>
      <h4>{label}</h4>
      <TagInput
        label="Permitir somente"
        tone="allow"
        suggestions={suggestions}
        values={included}
        disabled={disabled}
        onChange={onIncluded}
      />
      <TagInput
        label="Nunca sincronizar"
        tone="deny"
        suggestions={suggestions}
        values={excluded}
        disabled={disabled}
        onChange={onExcluded}
      />
    </article>
  );
}

function MultiSelect({
  label,
  tone,
  options,
  values,
  disabled,
  onChange,
}: {
  label: string;
  tone: "allow" | "deny";
  options: Option[];
  values: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const distinctOptions = uniqueOptions(options);
  const available = distinctOptions.filter(
    (option) => !values.includes(option.value),
  );
  const labels = new Map(
    distinctOptions.map((option) => [option.value, option.label]),
  );
  return (
    <div className={styles.multiField}>
      <span>{label}</span>
      <select
        disabled={disabled || available.length === 0}
        value=""
        onChange={(event) =>
          event.target.value && onChange([...values, event.target.value])
        }
      >
        <option value="">
          {available.length
            ? "Selecione para adicionar"
            : "Nenhuma opção disponível"}
        </option>
        {available.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.detail ? ` · ${option.detail}` : ""}
          </option>
        ))}
      </select>
      <ChipList
        tone={tone}
        values={values}
        labels={labels}
        disabled={disabled}
        onRemove={(value) => onChange(values.filter((item) => item !== value))}
      />
    </div>
  );
}

function TagInput({
  label,
  tone,
  suggestions,
  values,
  disabled,
  onChange,
}: {
  label: string;
  tone: "allow" | "deny";
  suggestions: string[];
  values: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const listId = `${useId()}-${tone}`;
  const availableSuggestions = unique(suggestions).filter(
    (value) => !values.includes(value),
  );
  function add() {
    const value = draft.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft("");
  }
  return (
    <div className={styles.multiField}>
      <span>{label}</span>
      <div className={styles.tagComposer}>
        <input
          list={listId}
          disabled={disabled}
          value={draft}
          placeholder="Digite ou escolha"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          aria-label={`Adicionar em ${label}`}
          disabled={disabled || !draft.trim()}
          type="button"
          onClick={add}
        >
          <Plus size={14} />
        </button>
      </div>
      <datalist id={listId}>
        {availableSuggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <ChipList
        tone={tone}
        values={values}
        disabled={disabled}
        onRemove={(value) => onChange(values.filter((item) => item !== value))}
      />
    </div>
  );
}

function ChipList({
  tone,
  values,
  labels,
  disabled,
  onRemove,
}: {
  tone: "allow" | "deny";
  values: string[];
  labels?: Map<string, string>;
  disabled: boolean;
  onRemove: (value: string) => void;
}) {
  if (values.length === 0)
    return <small className={styles.noRules}>Nenhum filtro</small>;
  const distinctValues = unique(values);
  return (
    <div className={styles.chips}>
      {distinctValues.map((value) => (
        <span
          className={tone === "allow" ? styles.allowChip : styles.denyChip}
          key={value}
        >
          {labels?.get(value) ?? value}
          <button
            aria-label={`Remover ${labels?.get(value) ?? value}`}
            disabled={disabled}
            type="button"
            onClick={() => onRemove(value)}
          >
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueOptions(options: Option[]): Option[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}
