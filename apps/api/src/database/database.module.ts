import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { createPrismaClient, type DatabaseClient } from "@integrador/db";

export const DATABASE_CLIENT = Symbol("DATABASE_CLIENT");

@Injectable()
class DatabaseLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.database.$disconnect();
  }
}

function databaseUrl(): string {
  const configured = process.env["DATABASE_URL"];
  if (configured) return configured;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("DATABASE_URL é obrigatória em produção");
  }
  return "postgresql://integrador:integrador@localhost:5432/integrador_bling";
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: (): DatabaseClient => createPrismaClient(databaseUrl()),
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule {}
