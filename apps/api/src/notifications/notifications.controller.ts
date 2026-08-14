import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { NotificationListResponse } from "@integrador/contracts";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { SessionGuard } from "../auth/session.guard.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("v1/notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query("limit") rawLimit?: string,
  ): Promise<NotificationListResponse> {
    const limit = Number.parseInt(rawLimit ?? "30", 10);
    return this.notifications.list(
      request.auth,
      Number.isInteger(limit) ? limit : 30,
    );
  }

  @Post("read-all")
  @HttpCode(204)
  markAllRead(@Req() request: AuthenticatedRequest): Promise<void> {
    return this.notifications.markAllRead(request.auth);
  }

  @Post(":id/read")
  @HttpCode(204)
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.notifications.markRead(request.auth, id);
  }
}
