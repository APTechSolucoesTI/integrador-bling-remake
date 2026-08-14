import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { OAuthController } from "./oauth.controller.js";
import { OAuthService } from "./oauth.service.js";
import { MarketplaceController } from "./marketplace.controller.js";
import { MarketplaceService } from "./marketplace.service.js";

@Module({
  imports: [AuthModule],
  controllers: [OAuthController, MarketplaceController],
  providers: [OAuthService, MarketplaceService],
})
export class IntegrationsModule {}
