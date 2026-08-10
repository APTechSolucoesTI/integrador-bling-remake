import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Redirect,
} from "@nestjs/common";
import { OAuthService } from "./oauth.service.js";

@Controller("v1/integrations")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get("bling/callback")
  @Redirect(undefined, 302)
  async bling(
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
  ): Promise<{ url: string; statusCode: number }> {
    this.assertCallback(code, state, error, "Bling");
    await this.oauth.completeBling(code!, state!);
    return { url: this.oauth.redirectUrl("bling"), statusCode: 302 };
  }

  @Get("mercado-livre/callback")
  @Redirect(undefined, 302)
  async mercadoLivre(
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
  ): Promise<{ url: string; statusCode: number }> {
    this.assertCallback(code, state, error, "Mercado Livre");
    await this.oauth.completeMercadoLivre(code!, state!);
    return {
      url: this.oauth.redirectUrl("mercado_livre"),
      statusCode: 302,
    };
  }

  private assertCallback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    integration: string,
  ): void {
    if (error)
      throw new BadRequestException(`Autorização do ${integration} recusada`);
    if (!code || !state)
      throw new BadRequestException(`Callback do ${integration} incompleto`);
  }
}
