import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  csvImportExecuteSchema,
  type CsvImportMetadataResponse,
  type CsvImportResult,
} from "@integrador/contracts";
import { SessionGuard } from "../auth/session.guard.js";
import { PermissionsGuard, RequirePermissions } from "../auth/roles.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { ImportsService } from "./imports.service.js";

@Controller("v1/imports")
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions("imports:manage")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get("metadata")
  metadata(@Req() request: AuthenticatedRequest): CsvImportMetadataResponse {
    return this.imports.metadata(request.auth);
  }

  @Post("csv")
  execute(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<CsvImportResult> {
    const parsed = csvImportExecuteSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message);
    return this.imports.execute(request.auth, parsed.data);
  }
}
