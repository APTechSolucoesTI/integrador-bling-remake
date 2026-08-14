"use client";

import {
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  FileCheck2,
  Fingerprint,
  Layers3,
  MoveUpRight,
  Orbit,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./landing.module.css";

const features = [
  {
    icon: FileCheck2,
    kicker: "Fiscal",
    title: "Cada NF-e, inteira.",
    text: "XML, PDF, status, boleto e rastreio reunidos em um fluxo auditável.",
    className: styles.featureWide,
  },
  {
    icon: CircleDollarSign,
    kicker: "Margem real",
    title: "Lucro sem aproximações.",
    text: "Custos, impostos, créditos e taxas calculados com precisão decimal.",
    className: styles.featureTall,
  },
  {
    icon: Waypoints,
    kicker: "Automações",
    title: "A operação segue em movimento.",
    text: "Jobs isolados, retentativas seguras e histórico para investigar cada execução.",
    className: "",
  },
  {
    icon: Layers3,
    kicker: "Multiempresa",
    title: "Uma visão. Vários contextos.",
    text: "Permissões e dados delimitados por empresa do navegador ao PostgreSQL.",
    className: "",
  },
] as const;

export function LandingExperience() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            entry.target.setAttribute("data-visible", "true");
        }
      },
      { threshold: 0.12 },
    );
    scope
      .querySelectorAll("[data-reveal]")
      .forEach((element) => reveal.observe(element));
    return () => reveal.disconnect();
  }, []);

  function moveScene(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--pointer-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--pointer-y", y.toFixed(3));
  }

  return (
    <main className={styles.site} ref={root}>
      <nav className={styles.nav} aria-label="Navegação principal">
        <Link
          className={styles.logo}
          href="/"
          aria-label="APBling, página inicial"
        >
          <span className={styles.logoMark}>
            <Orbit size={18} />
          </span>
          <strong>APBling</strong>
        </Link>
        <div className={styles.navLinks}>
          <a href="#plataforma">Plataforma</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#seguranca">Segurança</a>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.loginLink} href="/login">
            Entrar
          </Link>
          <Link className={styles.navCta} href="/demo">
            Ver demo <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroCopy} data-reveal>
          <span className={styles.eyebrow}>
            <Sparkles size={14} /> O novo centro da sua operação
          </span>
          <h1>
            Complexidade,
            <br />
            <span>sob controle.</span>
          </h1>
          <p>
            O Bling movimenta sua empresa. O APBling transforma cada nota, custo
            e integração em decisões claras — sem perder nenhum detalhe no
            caminho.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href="/demo">
              <Play size={16} fill="currentColor" /> Explorar a demo
            </Link>
            <a className={styles.secondaryCta} href="#plataforma">
              Conhecer a plataforma <ArrowRight size={16} />
            </a>
          </div>
          <div className={styles.proofLine}>
            <span>
              <Check size={14} /> Dados fictícios seguros
            </span>
            <span>
              <Check size={14} /> Sem cartão
            </span>
            <span>
              <Check size={14} /> Acesso imediato
            </span>
          </div>
        </div>

        <div
          className={styles.heroScene}
          onPointerMove={moveScene}
          onPointerLeave={(event) => {
            event.currentTarget.style.setProperty("--pointer-x", "0");
            event.currentTarget.style.setProperty("--pointer-y", "0");
          }}
          aria-label="Prévia animada do painel operacional"
        >
          <div className={`${styles.orbit} ${styles.orbitOne}`}>
            <i />
          </div>
          <div className={`${styles.orbit} ${styles.orbitTwo}`}>
            <i />
          </div>
          <div className={styles.sceneHalo} />
          <div className={styles.dashboardCard}>
            <div className={styles.miniTopbar}>
              <div>
                <span />
                <b>APBling</b>
              </div>
              <span className={styles.live}>
                <i /> Operação ao vivo
              </span>
            </div>
            <div className={styles.miniHeading}>
              <div>
                <small>AGOSTO 2026</small>
                <strong>Visão geral</strong>
              </div>
              <span className={styles.syncState}>
                Sincronizado <RefreshCw size={11} />
              </span>
            </div>
            <div className={styles.miniMetrics}>
              <div>
                <small>Faturamento</small>
                <strong>R$ 842.390</strong>
                <span>↗ 18,4%</span>
              </div>
              <div>
                <small>Lucro</small>
                <strong>R$ 194.622</strong>
                <span>23,1% margem</span>
              </div>
              <div>
                <small>Notas</small>
                <strong>1.284</strong>
                <span>96% processadas</span>
              </div>
            </div>
            <div className={styles.miniChart}>
              <div className={styles.chartCaption}>
                <span>Faturamento & lucro</span>
                <small>6 meses</small>
              </div>
              <svg
                viewBox="0 0 520 150"
                role="img"
                aria-label="Curvas de faturamento e lucro em crescimento"
              >
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#65e6c0" stopOpacity=".32" />
                    <stop offset="1" stopColor="#65e6c0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className={styles.areaPath}
                  d="M0 127 C60 117 82 100 128 105 S203 71 254 82 S330 42 390 53 S463 23 520 26 L520 150 L0 150Z"
                />
                <path
                  className={styles.linePath}
                  d="M0 127 C60 117 82 100 128 105 S203 71 254 82 S330 42 390 53 S463 23 520 26"
                />
                <path
                  className={styles.profitPath}
                  d="M0 139 C65 135 82 123 128 126 S201 108 254 112 S328 91 390 94 S460 77 520 73"
                />
              </svg>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.floatProfit}`}>
            <span>
              <ChartNoAxesCombined size={15} />
            </span>
            <div>
              <small>Margem agregada</small>
              <strong>23,10%</strong>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.floatSync}`}>
            <span>
              <RefreshCw size={15} />
            </span>
            <div>
              <small>Bling sincronizado</small>
              <strong>Agora mesmo</strong>
            </div>
          </div>
          <div className={`${styles.floatCard} ${styles.floatSecurity}`}>
            <ShieldCheck size={17} /> Tenant protegido
          </div>
        </div>
      </section>

      <section
        className={styles.trustStrip}
        aria-label="Capacidades da plataforma"
      >
        <span>BLING API V3</span>
        <i />
        <span>POSTGRESQL</span>
        <i />
        <span>NF-e + XML</span>
        <i />
        <span>MERCADO LIVRE</span>
        <i />
        <span>JOBS CONFIÁVEIS</span>
      </section>

      <section className={styles.platform} id="plataforma">
        <div className={styles.sectionIntro} data-reveal>
          <span className={styles.sectionKicker}>Tudo conectado</span>
          <h2>
            Menos abas.
            <br />
            <em>Mais contexto.</em>
          </h2>
          <p>
            Uma interface feita para revelar o que importa e preservar o detalhe
            quando você precisa investigar.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {features.map(({ icon: Icon, kicker, title, text, className }) => (
            <article
              className={`${styles.featureCard} ${className}`}
              key={title}
              data-reveal
            >
              <div className={styles.featureIcon}>
                <Icon size={20} />
              </div>
              <span>{kicker}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <MoveUpRight size={18} className={styles.featureArrow} />
              {kicker === "Fiscal" ? (
                <div className={styles.invoiceVisual} aria-hidden="true">
                  <div>
                    <span>NF-e 000010176</span>
                    <b>Autorizada</b>
                  </div>
                  <div>
                    <span>XML validado</span>
                    <b>100%</b>
                  </div>
                  <div>
                    <span>Boleto</span>
                    <b>Vinculado</b>
                  </div>
                </div>
              ) : null}
              {kicker === "Margem real" ? (
                <div className={styles.marginVisual} aria-hidden="true">
                  <div className={styles.marginRing}>
                    <strong>23,1</strong>
                    <small>%</small>
                  </div>
                  <span>Lucro / faturamento</span>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.flowSection} id="como-funciona">
        <div className={styles.flowVisual} data-reveal>
          <div className={styles.flowCore}>
            <Orbit size={30} />
            <strong>APBling</strong>
            <span>controle operacional</span>
          </div>
          <div className={`${styles.flowNode} ${styles.nodeBling}`}>
            <RefreshCw size={17} /> Bling
          </div>
          <div className={`${styles.flowNode} ${styles.nodePostgres}`}>
            <Boxes size={17} /> PostgreSQL
          </div>
          <div className={`${styles.flowNode} ${styles.nodeNfe}`}>
            <FileCheck2 size={17} /> NF-e
          </div>
          <div className={`${styles.flowNode} ${styles.nodeMarket}`}>
            <ChartNoAxesCombined size={17} /> Canais
          </div>
          <svg viewBox="0 0 600 500" aria-hidden="true">
            <ellipse cx="300" cy="250" rx="230" ry="170" />
            <ellipse cx="300" cy="250" rx="155" ry="112" />
          </svg>
        </div>
        <div className={styles.flowCopy} data-reveal>
          <span className={styles.sectionKicker}>Um fluxo contínuo</span>
          <h2>
            Do evento à decisão,
            <br />
            <em>sem pontos cegos.</em>
          </h2>
          <div className={styles.steps}>
            <div>
              <b>01</b>
              <span>
                <strong>Conecte com segurança</strong>
                <small>
                  OAuth, tokens cifrados e integrações isoladas por empresa.
                </small>
              </span>
            </div>
            <div>
              <b>02</b>
              <span>
                <strong>Deixe a operação trabalhar</strong>
                <small>
                  Sincronizações em background com retentativa e idempotência.
                </small>
              </span>
            </div>
            <div>
              <b>03</b>
              <span>
                <strong>Decida com o número completo</strong>
                <small>
                  Faturamento, custo, imposto e lucro no mesmo contexto.
                </small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.security} id="seguranca">
        <div className={styles.securityCard} data-reveal>
          <div className={styles.securityOrb}>
            <Fingerprint size={46} />
          </div>
          <div>
            <span className={styles.sectionKicker}>Segurança estrutural</span>
            <h2>
              Seu contexto nunca
              <br />é apenas um filtro.
            </h2>
            <p>
              O tenant é autorizado no servidor e percorre sessão, regras, jobs
              e consultas. A demo usa os mesmos limites, com integrações
              externas bloqueadas.
            </p>
            <ul>
              <li>
                <Check size={15} /> Sessões opacas em cookies HttpOnly
              </li>
              <li>
                <Check size={15} /> RBAC por empresa e auditoria
              </li>
              <li>
                <Check size={15} /> Segredos fora de logs e do navegador
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.finalCta} data-reveal>
        <div className={styles.finalGlow} />
        <span>
          <Sparkles size={15} /> PRONTO PARA EXPLORAR
        </span>
        <h2>
          Veja a operação
          <br /> ganhar clareza.
        </h2>
        <p>
          Acesse um ambiente seguro com dados fictícios e a experiência completa
          do dashboard.
        </p>
        <Link href="/demo">
          Abrir demonstração <ArrowRight size={17} />
        </Link>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.logo} href="/">
          <span className={styles.logoMark}>
            <Orbit size={18} />
          </span>
          <strong>APBling</strong>
        </Link>
        <p>Inteligência operacional para negócios que usam Bling.</p>
        <div>
          <Link href="/login">Entrar</Link>
          <Link href="/demo">Demo</Link>
          <span>© 2026 APTech</span>
        </div>
      </footer>
    </main>
  );
}
