import { runDatabaseCommand } from "./command.js";
import { migrateDatabase } from "./migration.js";

await runDatabaseCommand(migrateDatabase, "migration");
