"use client";

import type { GlobalSearchResult } from "@integrador/contracts";
import {
  Boxes,
  CircleDollarSign,
  FileText,
  LoaderCircle,
  Search,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { API_URL } from "../../lib/api";
import styles from "./application-global-search.module.css";

type SearchItem = GlobalSearchResult["items"][number];

const icons = {
  "invoice-operational": FileText,
  "invoice-financial": CircleDollarSign,
  person: UserRound,
  product: Boxes,
} satisfies Record<SearchItem["kind"], typeof Search>;

export function ApplicationGlobalSearch() {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setItems([]);
      setLoading(false);
      setFailed(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setItems([]);
    setActiveIndex(-1);
    async function request() {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(
          `${API_URL}/v1/search?q=${encodeURIComponent(query)}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error("search");
        const result = (await response.json()) as GlobalSearchResult;
        setItems(result.items);
        setActiveIndex(result.items.length > 0 ? 0 : -1);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setItems([]);
        setFailed(true);
        setActiveIndex(-1);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void request(), 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function focusSearch(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", focusSearch);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", focusSearch);
    };
  }, []);

  function select(item: SearchItem) {
    setOpen(false);
    setValue("");
    router.push(item.href);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? items.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) select(item);
    }
  }

  const showPanel = open && value.trim().length >= 2;

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.search} role="search">
        {loading ? (
          <LoaderCircle className={styles.spin} size={16} aria-hidden="true" />
        ) : (
          <Search size={16} aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          aria-autocomplete="list"
          aria-controls={showPanel ? listboxId : undefined}
          aria-expanded={showPanel}
          aria-label="Busca global"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          role="combobox"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={keyDown}
          placeholder="Buscar NF-e, pessoa ou produto..."
        />
        <kbd>Ctrl K</kbd>
      </div>

      {showPanel ? (
        <div className={styles.panel} id={listboxId} role="listbox">
          <div className={styles.panelHead}>
            <span>Resultados disponíveis para seu perfil</span>
            <small>{items.length} encontrado(s)</small>
          </div>
          {failed ? (
            <p className={styles.state}>Não foi possível concluir a busca.</p>
          ) : !loading && items.length === 0 ? (
            <p className={styles.state}>Nenhum resultado encontrado.</p>
          ) : (
            <div className={styles.results}>
              {items.map((item, index) => {
                const Icon = icons[item.kind];
                return (
                  <button
                    className={`${styles.item} ${index === activeIndex ? styles.active : ""}`}
                    id={`${listboxId}-${index}`}
                    key={item.id}
                    onClick={() => select(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    type="button"
                  >
                    <span className={styles.icon}>
                      <Icon size={17} />
                    </span>
                    <span className={styles.copy}>
                      <small>{item.category}</small>
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className={styles.panelFoot}>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navegar
            </span>
            <span>
              <kbd>Enter</kbd> abrir
            </span>
            <span>
              <kbd>Esc</kbd> fechar
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
