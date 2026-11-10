import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";
import { readLocalConfig } from "./src/config/local-config.js";

if (existsSync(".env.local")) loadEnvFile(".env.local");
const config = readLocalConfig(process.env);

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/database/schema.ts",
	out: "./drizzle",
	...(config.databaseUrl ? { dbCredentials: { url: config.databaseUrl } } : {}),
	migrations: { schema: "drizzle", table: "__drizzle_migrations" },
	strict: true,
});
