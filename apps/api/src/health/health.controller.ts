import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "Processo da API está operacional" })
  health(): { status: "ok"; service: "api" } {
    return { status: "ok", service: "api" };
  }
}
