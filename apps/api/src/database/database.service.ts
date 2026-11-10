import "reflect-metadata";
import { fileURLToPath } from "node:url";
import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// biome-ignore lint/style/useImportType: Nest constructor injection needs the runtime token.
import { ConfigService } from "../config/config.module.js";
import * as schema from "./schema.js";

export const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
	readonly pool: Pool | undefined;
	private readonly database: NodePgDatabase<typeof schema> | undefined;
	private closed = false;

	constructor(config: ConfigService) {
		if (!config.values.databaseUrl) return;
		this.pool = new Pool({
			connectionString: config.values.databaseUrl,
			max: 5,
			connectionTimeoutMillis: 2000,
			query_timeout: 2000,
			statement_timeout: 2000,
			idleTimeoutMillis: 10000,
		});
		this.pool.on("error", () => Logger.warn("Database pool connection lost", "Database"));
		this.database = drizzle(this.pool, { schema });
	}

	get db(): NodePgDatabase<typeof schema> {
		if (!this.database || this.closed)
			throw new Error("Local database is not configured or is closed");
		return this.database;
	}

	async ready(): Promise<boolean> {
		if (!this.pool || this.closed) return false;
		try {
			const expected = readMigrationFiles({ migrationsFolder }).at(-1);
			if (!expected) return false;
			const result = await this.pool.query<{ ready: boolean }>(
				`SELECT EXISTS (
					SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1
				) AND to_regclass('development.dev_fixture') IS NOT NULL AS ready`,
				[expected.hash],
			);
			return result.rows[0]?.ready === true;
		} catch {
			return false;
		}
	}

	async onApplicationShutdown(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		await this.pool?.end();
	}
}
