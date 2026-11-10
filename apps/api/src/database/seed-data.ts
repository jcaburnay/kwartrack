import type { DatabaseService } from "./database.service.js";
import { devFixture } from "./schema.js";

export async function seedDatabase(database: DatabaseService): Promise<void> {
	await database.db
		.insert(devFixture)
		.values({
			id: "foundation-demo",
			name: "Synthetic foundation fixture",
		})
		.onConflictDoUpdate({
			target: devFixture.id,
			set: { name: "Synthetic foundation fixture" },
		});
}
