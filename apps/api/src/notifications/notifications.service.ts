import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  notificationListResponseSchema,
  type NotificationListResponse,
} from "@integrador/contracts";
import type { DatabaseClient } from "@integrador/db";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async list(
    principal: AuthPrincipal,
    limit = 30,
  ): Promise<NotificationListResponse> {
    const permissionFilter = this.permissionFilter(principal);
    const [items, unread] = await Promise.all([
      this.database.systemNotification.findMany({
        where: { tenantId: principal.activeTenantId, ...permissionFilter },
        orderBy: { occurredAt: "desc" },
        take: Math.min(Math.max(limit, 1), 50),
        include: {
          reads: {
            where: { userId: principal.userId },
            select: { readAt: true },
          },
        },
      }),
      this.database.systemNotification.count({
        where: {
          tenantId: principal.activeTenantId,
          ...permissionFilter,
          reads: { none: { userId: principal.userId } },
        },
      }),
    ]);
    return notificationListResponseSchema.parse({
      unread,
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        level: notificationLevel(item.level),
        title: item.title,
        message: item.message,
        detail: jsonObject(item.detail),
        actionHref: item.actionHref,
        occurredAt: item.occurredAt.toISOString(),
        read: item.reads.length > 0,
      })),
    });
  }

  async markRead(principal: AuthPrincipal, id: string): Promise<void> {
    const notification = await this.database.systemNotification.findFirst({
      where: {
        id,
        tenantId: principal.activeTenantId,
        ...this.permissionFilter(principal),
      },
      select: { id: true },
    });
    if (!notification)
      throw new NotFoundException("Notificação não encontrada");
    await this.database.notificationRead.upsert({
      where: {
        notificationId_userId: { notificationId: id, userId: principal.userId },
      },
      create: { notificationId: id, userId: principal.userId },
      update: { readAt: new Date() },
    });
  }

  async markAllRead(principal: AuthPrincipal): Promise<void> {
    const notifications = await this.database.systemNotification.findMany({
      where: {
        tenantId: principal.activeTenantId,
        ...this.permissionFilter(principal),
        reads: { none: { userId: principal.userId } },
      },
      select: { id: true },
      take: 500,
    });
    if (!notifications.length) return;
    await this.database.notificationRead.createMany({
      data: notifications.map((item) => ({
        notificationId: item.id,
        userId: principal.userId,
      })),
      skipDuplicates: true,
    });
  }

  private permissionFilter(principal: AuthPrincipal) {
    return {
      OR: [{ permission: null }, { permission: { in: principal.permissions } }],
    };
  }
}

function notificationLevel(
  value: string,
): "info" | "success" | "warning" | "error" {
  return value === "success" || value === "warning" || value === "error"
    ? value
    : "info";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
