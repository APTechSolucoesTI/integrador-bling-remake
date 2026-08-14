"use client";

import type { SessionResponse } from "@integrador/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Orbit,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_URL } from "../../lib/api";
import { homeRoute } from "../../lib/home-route";
import styles from "./login.module.css";

export function MasterKeyForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/v1/auth/masterkey`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "E-mail ou chave de suporte inválidos."
            : "Não foi possível iniciar o acesso de suporte.",
        );
        return;
      }
      const session = (await response.json()) as SessionResponse;
      router.replace(homeRoute(session));
      router.refresh();
    } catch {
      setError("A API não respondeu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <Link className={styles.back} href="/login">
          <ArrowLeft size={16} /> Login convencional
        </Link>
        <div className={styles.storyCenter}>
          <Link className={styles.logo} href="/">
            <span><Orbit size={19} /></span>
            <strong>APBling</strong>
          </Link>
          <span className={styles.kicker}>
            <KeyRound size={13} /> ACESSO TÉCNICO CONTROLADO
          </span>
          <h1>Suporte no contexto correto.</h1>
          <p>
            Entre usando o e-mail do cliente. Todas as unidades vinculadas à
            identidade ficarão disponíveis no seletor de organização.
          </p>
          <div className={styles.storyPoints}>
            <span><ShieldCheck size={16} /> Acesso registrado na auditoria</span>
            <span><KeyRound size={16} /> Chave nunca registrada em logs</span>
          </div>
        </div>
        <div className={styles.orbits}><i /><i /><i /></div>
      </section>
      <section className={styles.formSide}>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <h2>Acesso de suporte</h2>
          <p>Informe cliente e chave master configurada no servidor.</p>
          <label>
            <span>E-mail do cliente</span>
            <input
              autoComplete="off"
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="cliente@empresa.com.br"
              required
            />
          </label>
          <label>
            <span>Chave master</span>
            <div className={styles.passwordField}>
              <input
                autoComplete="off"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                required
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar chave" : "Mostrar chave"}
                onClick={() => setVisible((current) => !current)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? <LoaderCircle className={styles.spinner} size={17} /> : null}
            {loading ? "Validando..." : "Acessar unidades do cliente"}
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
          <small className={styles.privacy}>
            Após 5 tentativas inválidas, acesso fica bloqueado por 15 minutos.
          </small>
        </form>
      </section>
    </main>
  );
}
