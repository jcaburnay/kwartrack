import { runDatabaseCommand } from "./command.js";
import { seedDatabase } from "./seed-data.js";

await runDatabaseCommand(seedDatabase, "seed");
