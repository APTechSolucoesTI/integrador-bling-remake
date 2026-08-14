import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { MarketplaceFeesController } from "./marketplace-fees.controller.js";
import { MarketplaceFeesService } from "./marketplace-fees.service.js";

@Module({
  imports: [AuthModule],
  controllers: [MarketplaceFeesController],
  providers: [MarketplaceFeesService],
})
export class MarketplaceFeesModule {}
