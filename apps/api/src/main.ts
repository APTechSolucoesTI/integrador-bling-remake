import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const RootModule =
  process.env["BOOTSTRAP_SMOKE_MODE"] === "true"
    ? (await import("./smoke.module.js")).SmokeModule
    : (await import("./app.module.js")).AppModule;
const app = await NestFactory.create(RootModule, { bufferLogs: true });
app.enableShutdownHooks();
app.enableCors({
  origin: process.env["WEB_ORIGIN"] ?? "http://localhost:3000",
  credentials: true,
});
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle("Integrador Bling API")
    .setDescription("API da modernização com isolamento explícito por tenant")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build(),
);
SwaggerModule.setup("docs", app, document);
await app.listen(Number(process.env["API_PORT"] ?? 3001), "0.0.0.0");
