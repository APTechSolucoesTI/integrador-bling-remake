import { Module } from "@nestjs/common";
import { OAuthController } from "./oauth.controller.js";
import { OAuthService } from "./oauth.service.js";
import { MarketplaceController } from "./marketplace.controller.js";
import { MarketplaceService } from "./marketplace.service.js";

@Module({
  controllers: [OAuthController, MarketplaceController],
  providers: [OAuthService, MarketplaceService],
})
export class IntegrationsModule {}
