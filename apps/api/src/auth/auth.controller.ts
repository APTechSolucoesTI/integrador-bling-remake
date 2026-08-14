import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  loginRequestSchema,
  masterKeyLoginRequestSchema,
  passwordChangeSchema,
  userPreferencesUpdateSchema,
  type SessionResponse,
} from "@integrador/contracts";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { SESSION_COOKIE, SessionGuard } from "./session.guard.js";

const tenantSwitchSchema = z.object({ tenantId: z.uuid() });

@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    assertTrustedOrigin(request);
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Credenciais inválidas");
    const result = await this.auth.login(
      parsed.data.email,
      parsed.data.password,
    );
    response.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return result.session;
  }

  @Post("masterkey")
  @HttpCode(200)
  async masterKeyLogin(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    assertTrustedOrigin(request);
    const parsed = masterKeyLoginRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Credenciais inválidas");
    const result = await this.auth.masterKeyLogin(
      parsed.data.email,
      parsed.data.password,
      request.ip ?? request.socket.remoteAddress ?? "unknown",
    );
    response.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return result.session;
  }

  @Get("session")
  @UseGuards(SessionGuard)
  session(@Req() request: AuthenticatedRequest): Promise<SessionResponse> {
    return this.auth.session(request.auth);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertTrustedOrigin(request);
    await this.auth.logout(request.auth.sessionId);
    response.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Post("tenant")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async switchTenant(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    assertTrustedOrigin(request);
    const parsed = tenantSwitchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Tenant inválido");
    await this.auth.switchTenant(request.auth, parsed.data.tenantId);
  }

  @Patch("password")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async changePassword(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    assertTrustedOrigin(request);
    const parsed = passwordChangeSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("Alteração de senha inválida");
    await this.auth.changePassword(request.auth, parsed.data);
  }

  @Patch("preferences")
  @UseGuards(SessionGuard)
  async updatePreferences(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<SessionResponse> {
    assertTrustedOrigin(request);
    const parsed = userPreferencesUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("Preferências inválidas");
    return this.auth.updatePreferences(request.auth, parsed.data);
  }
}

function cookieOptions() {
  const secure =
    process.env["COOKIE_SECURE"] === undefined
      ? process.env["NODE_ENV"] === "production"
      : process.env["COOKIE_SECURE"] === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.origin;
  const expected = process.env["WEB_ORIGIN"] ?? "http://localhost:3000";
  if (origin && origin !== expected) {
    throw new BadRequestException("Origem não autorizada");
  }
}
