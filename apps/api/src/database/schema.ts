import { pgSchema, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const development = pgSchema("development");

export const devFixture = development.table("dev_fixture", {
	id: text("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
