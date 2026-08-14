"use client";

import type {
  Notification,
  NotificationListResponse,
  SessionResponse,
} from "@integrador/contracts";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../../lib/api";
import styles from "./application-header-actions.module.css";

export function ApplicationHeaderActions({
  session,
  onLogout,
}: {
  session: SessionResponse;
  onLogout: () => void | Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<NotificationListResponse>({
    unread: 0,
    items: [],
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const response = await fetch(`${API_URL}/v1/notifications?limit=30`, {
        credentials: "include",
      });
      if (response.ok)
        setNotifications((await response.json()) as NotificationListResponse);
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 45_000);
    return () => window.clearInterval(timer);
  }, [session.tenant.id]);

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setPasswordOpen(false);
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  async function openNotification(notification: Notification) {
    setSelected(notification);
    setNotificationsOpen(false);
    if (notification.read) return;
    setNotifications((current) => ({
      unread: Math.max(0, current.unread - 1),
      items: current.items.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    }));
    await fetch(`${API_URL}/v1/notifications/${notification.id}/read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  }

  async function markAllRead() {
    setNotifications((current) => ({
      unread: 0,
      items: current.items.map((item) => ({ ...item, read: true })),
    }));
    await fetch(`${API_URL}/v1/notifications/read-all`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  }

  return (
    <>
      <div className={styles.actions} ref={rootRef}>
        <div className={styles.actionSlot}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Abrir notificações"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setProfileOpen(false);
              if (!notificationsOpen) void loadNotifications();
            }}
          >
            <Bell size={18} />
            {notifications.unread > 0 ? (
              <span className={styles.badge}>
                {notifications.unread > 99 ? "99+" : notifications.unread}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <section className={styles.notificationMenu}>
              <header>
                <div>
                  <span>CENTRAL DE ATIVIDADES</span>
                  <h2>Notificações</h2>
                </div>
                {notifications.unread ? (
                  <button type="button" onClick={() => void markAllRead()}>
                    <CheckCheck size={14} /> Marcar lidas
                  </button>
                ) : null}
              </header>
              <div className={styles.notificationList}>
                {loadingNotifications && !notifications.items.length ? (
                  <p className={styles.empty}>Carregando atividades...</p>
                ) : notifications.items.length ? (
                  notifications.items.map((notification) => (
                    <button
                      className={`${styles.notificationItem} ${notification.read ? "" : styles.unread}`}
                      type="button"
                      key={notification.id}
                      onClick={() => void openNotification(notification)}
                    >
                      <NotificationIcon level={notification.level} />
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.message}</small>
                        <time>{formatDateTime(notification.occurredAt)}</time>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <Bell size={20} />
                    <strong>Nenhuma atividade recente</strong>
                    <span>
                      Sincronizações e envios de NF-e aparecerão aqui.
                    </span>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <div className={styles.actionSlot}>
          <button
            className={styles.profileButton}
            type="button"
            aria-label="Abrir meu perfil"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen((value) => !value);
              setNotificationsOpen(false);
            }}
          >
            <span>{initials(session.user.name)}</span>
            <div>
              <strong>{firstName(session.user.name)}</strong>
              <small>{session.accessProfile.name}</small>
            </div>
          </button>
          {profileOpen ? (
            <section className={styles.profileMenu}>
              <header>
                <span>{initials(session.user.name)}</span>
                <div>
                  <strong>{session.user.name}</strong>
                  <small>{session.user.email}</small>
                </div>
              </header>
              <div className={styles.profileContext}>
                <UserRound size={15} />
                <span>
                  <small>Perfil de acesso</small>
                  <strong>{session.accessProfile.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setPasswordOpen(true);
                }}
              >
                <KeyRound size={16} /> Alterar minha senha
              </button>
              <button
                className={styles.logoutButton}
                type="button"
                onClick={() => void onLogout()}
              >
                <LogOut size={16} /> Sair da plataforma
              </button>
            </section>
          ) : null}
        </div>
      </div>

      {portalReady && passwordOpen
        ? createPortal(
            <PasswordDialog onClose={() => setPasswordOpen(false)} />,
            document.body,
          )
        : null}
      {portalReady && selected
        ? createPortal(
            <NotificationDetail
              notification={selected}
              onClose={() => setSelected(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/v1/auth/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Senha atual incorreta."
            : "Não foi possível alterar a senha.",
        );
        return;
      }
      setSuccess(true);
    } catch {
      setError("API indisponível. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.passwordDialog}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span>SEGURANÇA DA CONTA</span>
            <h2>Alterar senha</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {success ? (
          <div className={styles.passwordSuccess}>
            <CircleCheck size={25} />
            <h3>Senha atualizada</h3>
            <p>As outras sessões foram encerradas por segurança.</p>
            <button type="button" onClick={onClose}>
              Concluir
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <label>
              <span>Senha atual</span>
              <input
                autoFocus
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Nova senha</span>
              <div className={styles.passwordInput}>
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={10}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small>Mínimo de 10 caracteres.</small>
            </label>
            <label>
              <span>Confirmar nova senha</span>
              <input
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={10}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </label>
            {error ? <p className={styles.formError}>{error}</p> : null}
            <footer>
              <button type="button" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}>
                <Check size={15} />{" "}
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

function NotificationDetail({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const details = Object.entries(notification.detail).filter(
    ([, value]) => value !== null && value !== "" && value !== undefined,
  );
  return (
    <div className={styles.backdrop} role="presentation">
      <aside className={styles.detailDrawer} role="dialog" aria-modal="true">
        <header>
          <NotificationIcon level={notification.level} />
          <div>
            <span>DETALHAMENTO DA ATIVIDADE</span>
            <h2>{notification.title}</h2>
            <time>{formatDateTime(notification.occurredAt)}</time>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={styles.detailBody}>
          <p>{notification.message}</p>
          {details.length ? (
            <dl>
              {details.map(([key, value]) => (
                <div key={key}>
                  <dt>{detailLabel(key)}</dt>
                  <dd>{detailValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className={styles.noDetail}>
              <Settings2 size={18} /> Sem dados adicionais para esta atividade.
            </div>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Fechar
          </button>
          {notification.actionHref ? (
            <Link href={notification.actionHref} onClick={onClose}>
              Abrir registros <ChevronRight size={15} />
            </Link>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

function NotificationIcon({ level }: { level: Notification["level"] }) {
  if (level === "error")
    return <CircleAlert className={styles.errorIcon} size={20} />;
  if (level === "warning")
    return <AlertTriangle className={styles.warningIcon} size={20} />;
  return <CircleCheck className={styles.successIcon} size={20} />;
}

function detailLabel(value: string): string {
  const labels: Record<string, string> = {
    persisted: "Notas sincronizadas",
    fetched: "Registros consultados",
    delivered: "Notas enviadas",
    ignoredByPolicy: "Ignoradas pelas regras",
    enriched: "Notas detalhadas",
    enrichmentFailed: "Falhas no detalhamento",
    updated: "Registros atualizados",
    created: "Registros criados",
    periodoInicial: "Período inicial",
    periodoFinal: "Período final",
    erro: "Tipo do erro",
    mensagem: "Mensagem técnica",
    nfeId: "Código interno da NF-e",
  };
  return labels[value] ?? value.replace(/([A-Z])/g, " $1").trim();
}

function detailValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value) ?? "Dado indisponível";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
