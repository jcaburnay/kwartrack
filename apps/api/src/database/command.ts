import { Logger } from "@nestjs/common";
import { ConfigService } from "../config/config.module.js";
import { readLocalConfig } from "../config/local-config.js";
import { DatabaseService } from "./database.service.js";

export async function runDatabaseCommand(
	command: (database: DatabaseService) => Promise<void>,
	label: string,
): Promise<void> {
	let database: DatabaseService | undefined;
	try {
		const config = readLocalConfig(process.env);
		if (!config.databaseUrl) throw new Error("Local DATABASE_URL is required");
		database = new DatabaseService(new ConfigService(config));
		await command(database);
		Logger.log(`Local database ${label} completed`, "Database");
	} catch (error) {
		const message =
			error instanceof Error && error.message.startsWith("Invalid local configuration:")
				? error.message
				: `Local database ${label} failed; check local configuration and database readiness`;
		Logger.error(message, "Database");
		process.exitCode = 1;
	} finally {
		await database?.onApplicationShutdown();
	}
}
