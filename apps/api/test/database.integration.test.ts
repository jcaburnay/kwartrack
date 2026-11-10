import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../dist/application.js";
import { readLocalConfig } from "../dist/config/local-config.js";
import { DatabaseService } from "../dist/database/database.service.js";
import { migrateDatabase } from "../dist/database/migration.js";
import { devFixture } from "../dist/database/schema.js";
import { seedDatabase } from "../dist/database/seed-data.js";

if (existsSync(".env.local")) loadEnvFile(".env.local");

describe("local PostgreSQL foundation", () => {
	let admin: Pool | undefined;
	let database: DatabaseService | undefined;
	let app: INestApplication | undefined;
	const databaseName = `kwartrack_api_test_${randomUUID().replaceAll("-", "")}`;
	let created = false;

	beforeAll(async () => {
		const config = readLocalConfig(process.env);
		if (!config.databaseUrl) throw new Error("Integration tests require a local DATABASE_URL");
		admin = new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 2000 });
		await admin.query(`CREATE DATABASE "${databaseName}"`);
		created = true;
		const isolatedUrl = new URL(config.databaseUrl);
		isolatedUrl.pathname = `/${databaseName}`;
		app = await createApplication(
			readLocalConfig({ ...process.env, DATABASE_URL: isolatedUrl.href }),
		);
		await app.init();
		database = app.get(DatabaseService);
	}, 10000);

	afterAll(async () => {
		await app?.close();
		if (created) await admin?.query(`DROP DATABASE "${databaseName}"`);
		await admin?.end();
	});

	it("is unready until migrations are applied, then supports repeatable migration and seed", async () => {
		expect(await database!.ready()).toBe(false);
		await request(app!.getHttpServer())
			.get("/health/ready")
			.expect(503)
			.expect({ status: "unavailable" });
		await request(app!.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
		await migrateDatabase(database!);
		await migrateDatabase(database!);
		expect(await database!.ready()).toBe(true);
		await request(app!.getHttpServer()).get("/health/ready").expect(200).expect({ status: "ok" });
		await request(app!.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
		await seedDatabase(database!);
		await seedDatabase(database!);
		const rows = await database!.db.select().from(devFixture);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: "foundation-demo", name: "Synthetic foundation fixture" });
	});

	it("commits a transaction that can be reread through Drizzle", async () => {
		await database!.db.transaction(async (tx) => {
			await tx
				.insert(devFixture)
				.values({ id: "integration-commit", name: "Committed synthetic fixture" });
		});
		await seedDatabase(database!);
		const [row] = await database!.db
			.select()
			.from(devFixture)
			.where(eq(devFixture.id, "integration-commit"));
		expect(row?.name).toBe("Committed synthetic fixture");
	});

	it("rolls back all writes when the transaction fails", async () => {
		await expect(
			database!.db.transaction(async (tx) => {
				await tx
					.insert(devFixture)
					.values({ id: "integration-rollback", name: "Must not persist" });
				throw new Error("intentional rollback");
			}),
		).rejects.toThrow("intentional rollback");
		expect(
			await database!.db.select().from(devFixture).where(eq(devFixture.id, "integration-rollback")),
		).toEqual([]);
	});

	it("bounds readiness waiting on a saturated pool and recovers without restarting", async () => {
		const clients = await Promise.all(Array.from({ length: 5 }, () => database!.pool!.connect()));
		try {
			const start = performance.now();
			await Promise.all([
				request(app!.getHttpServer())
					.get("/health/ready")
					.expect(503)
					.expect({ status: "unavailable" }),
				request(app!.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" }),
			]);
			expect(performance.now() - start).toBeLessThan(3500);
		} finally {
			for (const client of clients) client.release();
		}
		await request(app!.getHttpServer()).get("/health/ready").expect(200).expect({ status: "ok" });
	});

	it("keeps liveness available while readiness fails after its pool is closed", async () => {
		await database!.onApplicationShutdown();
		expect(await database!.ready()).toBe(false);
		await request(app!.getHttpServer())
			.get("/health/ready")
			.expect(503)
			.expect({ status: "unavailable" });
		await request(app!.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
	});
});
