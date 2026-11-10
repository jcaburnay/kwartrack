import { migrate } from "drizzle-orm/node-postgres/migrator";
import { type DatabaseService, migrationsFolder } from "./database.service.js";

export async function migrateDatabase(database: DatabaseService): Promise<void> {
	await migrate(database.db, { migrationsFolder, migrationsSchema: "drizzle" });
}
