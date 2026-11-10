import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest needs the runtime injection token.
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class HealthService {
	constructor(private readonly database: DatabaseService) {}

	live() {
		return { status: "ok" };
	}

	ready() {
		return this.database.ready();
	}
}
