"use client";

import type {
  CsvImportEntity,
  CsvImportMetadataResponse,
  CsvImportResult,
} from "@integrador/contracts";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../../lib/api";
import styles from "./smart-csv-import.module.css";

type Entity = CsvImportMetadataResponse["entities"][number];
type CsvData = { headers: string[]; rows: string[][]; delimiter: string };

export function SmartCsvImportButton({
  defaultEntity,
  onComplete,
  compact = false,
}: {
  defaultEntity?: CsvImportEntity;
  onComplete?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Importar dados por CSV"
      >
        <Upload size={15} /> {compact ? "Importar" : "Importação inteligente"}
      </button>
      {open ? (
        <SmartCsvImport
          {...(defaultEntity ? { defaultEntity } : {})}
          onClose={() => setOpen(false)}
          {...(onComplete ? { onComplete } : {})}
        />
      ) : null}
    </>
  );
}

function SmartCsvImport({
  defaultEntity,
  onClose,
  onComplete,
}: {
  defaultEntity?: CsvImportEntity;
  onClose: () => void;
  onComplete?: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [metadata, setMetadata] = useState<CsvImportMetadataResponse | null>(
    null,
  );
  const [entityKey, setEntityKey] = useState<CsvImportEntity | "">(
    defaultEntity ?? "",
  );
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/v1/imports/metadata`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseText(response));
        return (await response.json()) as CsvImportMetadataResponse;
      })
      .then((value) => {
        if (!active) return;
        setMetadata(value);
        if (!entityKey && value.entities[0])
          setEntityKey(value.entities[0].key);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível abrir o importador.",
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [entityKey]);

  const entity =
    metadata?.entities.find((item) => item.key === entityKey) ?? null;
  const missingRequired =
    entity?.fields.filter((field) => field.required && !mapping[field.key]) ??
    [];
  const mappedRows = useMemo(
    () => (csv && entity ? mapRows(csv, entity, mapping) : []),
    [csv, entity, mapping],
  );

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      if (file.size > 15 * 1024 * 1024)
        throw new Error("CSV deve ter no máximo 15 MB.");
      const text = decodeCsv(await file.arrayBuffer());
      const parsed = parseCsv(text);
      if (!parsed.headers.length || !parsed.rows.length)
        throw new Error("CSV vazio ou sem linhas de dados.");
      if (parsed.rows.length > 25_000)
        throw new Error("Importe no máximo 25.000 linhas por arquivo.");
      setFileName(file.name);
      setCsv(parsed);
      setMapping(entity ? automaticMapping(parsed.headers, entity) : {});
      setStep(2);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível ler o CSV.",
      );
    }
  }

  function changeEntity(next: CsvImportEntity) {
    setEntityKey(next);
    const nextEntity = metadata?.entities.find((item) => item.key === next);
    setMapping(
      csv && nextEntity ? automaticMapping(csv.headers, nextEntity) : {},
    );
    setResult(null);
  }

  async function execute() {
    if (!entity || !mappedRows.length || missingRequired.length) return;
    setImporting(true);
    setError(null);
    const aggregate: CsvImportResult = {
      entity: entity.key,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
    try {
      for (let offset = 0; offset < mappedRows.length; offset += 250) {
        const rows = mappedRows.slice(offset, offset + 250);
        const response = await fetch(`${API_URL}/v1/imports/csv`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entity: entity.key, rows }),
        });
        if (!response.ok) throw new Error(await responseText(response));
        const batch = (await response.json()) as CsvImportResult;
        aggregate.processed += batch.processed;
        aggregate.created += batch.created;
        aggregate.updated += batch.updated;
        aggregate.failed += batch.failed;
        aggregate.errors.push(
          ...batch.errors.map((item) => ({ ...item, row: item.row + offset })),
        );
      }
      setResult(aggregate);
      setStep(3);
      await onComplete?.();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Importação interrompida.",
      );
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    if (!entity) return;
    const content = `${entity.fields.map((item) => item.label).join(";")}\r\n`;
    const blob = new Blob(["\uFEFF", content], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `modelo-${entity.key}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
      >
        <header className={styles.header}>
          <div className={styles.headingIcon}>
            <Sparkles size={19} />
          </div>
          <div>
            <span>IMPORTAÇÃO ASSISTIDA</span>
            <h2 id="csv-import-title">Trazer dados por CSV</h2>
            <p>
              Mapeie qualquer planilha antiga para os campos atuais, sem
              duplicar IDs existentes.
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <nav className={styles.steps} aria-label="Etapas da importação">
          {(
            [
              [1, "Arquivo"],
              [2, "Mapeamento"],
              [3, "Resultado"],
            ] as const
          ).map(([number, label]) => (
            <div
              key={number}
              className={step >= number ? styles.stepActive : styles.step}
            >
              <b>{number}</b>
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>
              <LoaderCircle className={styles.spin} /> Carregando estruturas
              disponíveis...
            </div>
          ) : null}
          {!loading && metadata?.entities.length === 0 ? (
            <div className={styles.notice}>
              <AlertCircle /> Seu perfil não possui permissão de importação.
            </div>
          ) : null}
          {error ? (
            <div className={styles.error}>
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && metadata?.entities.length && step === 1 ? (
            <div className={styles.firstStep}>
              <label className={styles.field}>
                <span>O que deseja importar?</span>
                <select
                  value={entityKey}
                  onChange={(event) =>
                    changeEntity(event.target.value as CsvImportEntity)
                  }
                >
                  {metadata.entities.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <small>{entity?.description}</small>
              </label>
              <button
                type="button"
                className={styles.template}
                onClick={downloadTemplate}
              >
                <Download size={15} /> Baixar modelo deste cadastro
              </button>
              <button
                type="button"
                className={styles.dropzone}
                onClick={() => inputRef.current?.click()}
              >
                <FileSpreadsheet size={36} />
                <strong>Selecione seu arquivo CSV</strong>
                <span>
                  Vírgula, ponto e vírgula ou tabulação · UTF-8 ou Windows-1252
                  · até 15 MB
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                hidden
                accept=".csv,text/csv"
                onChange={(event) => void selectFile(event.target.files?.[0])}
              />
            </div>
          ) : null}

          {step === 2 && csv && entity ? (
            <div className={styles.mappingStep}>
              <div className={styles.fileSummary}>
                <FileSpreadsheet size={20} />
                <div>
                  <strong>{fileName}</strong>
                  <span>
                    {csv.rows.length.toLocaleString("pt-BR")} linhas ·{" "}
                    {csv.headers.length} colunas · separador{" "}
                    {delimiterName(csv.delimiter)}
                  </span>
                </div>
                <button type="button" onClick={() => setStep(1)}>
                  Trocar arquivo
                </button>
              </div>
              <div className={styles.mappingHeader}>
                <div>
                  <h3>Associe as colunas</h3>
                  <p>
                    Sugestões foram preenchidas por nome e aliases conhecidos.
                  </p>
                </div>
                <label>
                  <span>Cadastro</span>
                  <select
                    value={entityKey}
                    onChange={(event) =>
                      changeEntity(event.target.value as CsvImportEntity)
                    }
                  >
                    {metadata?.entities.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.mappingGrid}>
                {entity.fields.map((field) => (
                  <label
                    key={field.key}
                    className={
                      field.required && !mapping[field.key]
                        ? styles.mappingMissing
                        : styles.mappingField
                    }
                  >
                    <span>
                      {field.label}
                      {field.required ? <b>Obrigatório</b> : null}
                    </span>
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Não importar</option>
                      {csv.headers.map((header, index) => (
                        <option
                          key={`${header}-${index}`}
                          value={String(index)}
                        >
                          {header || `Coluna ${index + 1}`}
                        </option>
                      ))}
                    </select>
                    {field.description ? (
                      <small>{field.description}</small>
                    ) : null}
                  </label>
                ))}
              </div>
              <div className={styles.preview}>
                <div>
                  <h3>Prévia dos dados</h3>
                  <span>Primeiras {Math.min(5, mappedRows.length)} linhas</span>
                </div>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        {entity.fields
                          .filter((field) => mapping[field.key])
                          .map((field) => (
                            <th key={field.key}>{field.label}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappedRows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {entity.fields
                            .filter((field) => mapping[field.key])
                            .map((field) => (
                              <td key={field.key}>{row[field.key] || "—"}</td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {missingRequired.length ? (
                <div className={styles.notice}>
                  <AlertCircle size={16} /> Mapeie:{" "}
                  {missingRequired.map((item) => item.label).join(", ")}.
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 && result ? (
            <div className={styles.resultStep}>
              <div
                className={
                  result.failed ? styles.resultWarning : styles.resultSuccess
                }
              >
                <CheckCircle2 size={30} />
                <div>
                  <h3>Importação concluída</h3>
                  <p>
                    {result.processed.toLocaleString("pt-BR")} linhas
                    processadas em {entity?.label}.
                  </p>
                </div>
              </div>
              <div className={styles.metrics}>
                <div>
                  <span>Criados</span>
                  <strong>{result.created}</strong>
                </div>
                <div>
                  <span>Atualizados</span>
                  <strong>{result.updated}</strong>
                </div>
                <div>
                  <span>Com erro</span>
                  <strong>{result.failed}</strong>
                </div>
              </div>
              {result.errors.length ? (
                <div className={styles.errorList}>
                  <h3>Linhas que precisam de correção</h3>
                  {result.errors.slice(0, 50).map((item) => (
                    <div key={`${item.row}-${item.message}`}>
                      <b>Linha {item.row + 1}</b>
                      <span>{item.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.cleanResult}>
                  <CheckCircle2 size={18} /> Todas as linhas foram gravadas.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <footer className={styles.footer}>
          {step === 2 ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setStep(1)}
              disabled={importing}
            >
              <ArrowLeft size={15} /> Voltar
            </button>
          ) : (
            <span />
          )}
          {step === 2 ? (
            <button
              type="button"
              className={styles.primary}
              disabled={
                importing || !!missingRequired.length || !mappedRows.length
              }
              onClick={() => void execute()}
            >
              {importing ? (
                <LoaderCircle className={styles.spin} size={16} />
              ) : (
                <Upload size={16} />
              )}{" "}
              Importar {mappedRows.length.toLocaleString("pt-BR")} linhas
            </button>
          ) : null}
          {step === 3 ? (
            <button type="button" className={styles.primary} onClick={onClose}>
              Concluir <ArrowRight size={15} />
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function automaticMapping(
  headers: string[],
  entity: Entity,
): Record<string, string> {
  const normalizedHeaders = headers.map(normalize);
  return Object.fromEntries(
    entity.fields.flatMap((field) => {
      const candidates = [field.key, field.label, ...field.aliases].map(
        normalize,
      );
      const index = normalizedHeaders.findIndex((header) =>
        candidates.includes(header),
      );
      return index >= 0 ? [[field.key, String(index)]] : [];
    }),
  );
}
function mapRows(
  csv: CsvData,
  entity: Entity,
  mapping: Record<string, string>,
): Record<string, string>[] {
  return csv.rows
    .filter((row) => row.some((value) => value.trim()))
    .map((row) =>
      Object.fromEntries(
        entity.fields.flatMap((field) => {
          const index = mapping[field.key];
          return index === undefined || index === ""
            ? []
            : [[field.key, row[Number(index)]?.trim() ?? ""]];
        }),
      ),
    );
}
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
function parseCsv(text: string): CsvData {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const delimiter =
    [";", ",", "\t"].sort(
      (a, b) => countDelimiter(firstLine, b) - countDelimiter(firstLine, a),
    )[0] ?? ";";
  const matrix: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    if (character === '"') {
      if (quoted && clean[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" && !quoted) {
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  row.push(cell);
  if (row.some((value) => value.length)) matrix.push(row);
  const headers = (matrix.shift() ?? []).map(
    (value, index) => value.trim() || `Coluna ${index + 1}`,
  );
  return { headers, rows: matrix, delimiter };
}
function countDelimiter(line: string, delimiter: string): number {
  let count = 0,
    quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) count += 1;
  }
  return count;
}
function delimiterName(value: string): string {
  return value === ";"
    ? "ponto e vírgula"
    : value === ","
      ? "vírgula"
      : "tabulação";
}
async function responseText(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  return Array.isArray(payload?.message)
    ? payload.message.join(". ")
    : (payload?.message ?? "Falha na importação.");
}
