"use client";

import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Orbit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_URL } from "../../lib/api";
import { homeRoute } from "../../lib/home-route";
import type { SessionResponse } from "@integrador/contracts";
import styles from "./login.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "E-mail ou senha inválidos."
            : "Não foi possível entrar agora.",
        );
        return;
      }
      const session = (await response.json()) as SessionResponse;
      router.replace(homeRoute(session));
      router.refresh();
    } catch {
      setError(
        "A API não respondeu. Verifique se o ambiente local está em execução.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <Link className={styles.back} href="/">
          <ArrowLeft size={16} /> Página inicial
        </Link>
        <div className={styles.storyCenter}>
          <Link className={styles.logo} href="/">
            <span>
              <Orbit size={19} />
            </span>
            <strong>APBling</strong>
          </Link>
          <span className={styles.kicker}>
            <Sparkles size={13} /> CONTROLE EM MOVIMENTO
          </span>
          <h1>
            Uma operação clara
            <br />
            começa por aqui.
          </h1>
          <p>
            Notas, integrações e margem no contexto exato da sua empresa — com
            acesso seguro e auditável.
          </p>
          <div className={styles.storyPoints}>
            <span>
              <ShieldCheck size={16} /> Tenant autorizado no servidor
            </span>
            <span>
              <LockKeyhole size={16} /> Sessão protegida em cookie HttpOnly
            </span>
          </div>
        </div>
        <div className={styles.orbits}>
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className={styles.formSide}>
        <form onSubmit={(event) => void submit(event)} className={styles.form}>
          <h2>Bem-vindo de volta.</h2>
          <p>Use suas credenciais para continuar.</p>
          <label>
            <span>E-mail</span>
            <input
              autoComplete="email"
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com.br"
              required
            />
          </label>
          <label>
            <span>Senha</span>
            <div className={styles.passwordField}>
              <input
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                minLength={10}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? (
              <LoaderCircle className={styles.spinner} size={17} />
            ) : null}
            {loading ? "Entrando..." : "Entrar na plataforma"}
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
          <Link className={styles.demoLink} href="/demo">
            Ainda não conhece? Explore a demonstração <ArrowRight size={14} />
          </Link>
          <small className={styles.privacy}>
            Ao entrar, você acessa somente as empresas vinculadas ao seu
            usuário.
          </small>
        </form>
      </section>
    </main>
  );
}
