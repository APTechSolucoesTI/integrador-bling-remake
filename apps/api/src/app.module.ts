import { Module } from "@nestjs/common";
import { AdministrationModule } from "./administration/administration.module.js";
import { BusinessModule } from "./business/business.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { IntegrationsModule } from "./integrations/integrations.module.js";
import { ImportsModule } from "./imports/imports.module.js";
import { NfeModule } from "./nfe/nfe.module.js";
import { MarketplaceFeesModule } from "./marketplace-fees/marketplace-fees.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { QueueModule } from "./queue/queue.module.js";

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    AuthModule,
    DashboardModule,
    NfeModule,
    MarketplaceFeesModule,
    CatalogModule,
    AdministrationModule,
    BusinessModule,
    IntegrationsModule,
    ImportsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
