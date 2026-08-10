import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
