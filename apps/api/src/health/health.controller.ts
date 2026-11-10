import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
// biome-ignore lint/style/useImportType: Nest needs this runtime class for emitted injection metadata.
import { HealthService } from "./health.service.js";

@Controller("health")
@ApiTags("health")
export class HealthController {
	constructor(private readonly health: HealthService) {}

	@Get("live")
	@ApiOkResponse({
		schema: {
			type: "object",
			required: ["status"],
			properties: { status: { type: "string", enum: ["ok"] } },
		},
	})
	live() {
		return this.health.live();
	}

	@Get("ready")
	@ApiOkResponse({
		schema: {
			type: "object",
			required: ["status"],
			properties: { status: { type: "string", enum: ["ok"] } },
		},
	})
	@ApiServiceUnavailableResponse({
		schema: {
			type: "object",
			required: ["status"],
			properties: { status: { type: "string", enum: ["unavailable"] } },
		},
	})
	async ready() {
		if (!(await this.health.ready()))
			throw new ServiceUnavailableException({ status: "unavailable" });
		return { status: "ok" };
	}
}
