import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, expect, it } from "vitest";
import { createApplication } from "../dist/application.js";
import { readLocalConfig } from "../dist/config/local-config.js";

let app: INestApplication | undefined;

afterEach(async () => {
	await app?.close();
});

it("serves liveness from the compiled API without infrastructure dependencies", async () => {
	app = await createApplication(readLocalConfig({ APP_ENV: "local" }));
	await app.init();
	await request(app.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
});

it("releases the listener when the application closes", async () => {
	app = await createApplication(readLocalConfig({ APP_ENV: "local" }));
	await app.listen(0, "127.0.0.1");
	const url = await app.getUrl();
	expect((await fetch(`${url}/health/live`)).status).toBe(200);
	await app.close();
	await expect(fetch(`${url}/health/live`)).rejects.toThrow();
});

it("reports unavailable readiness without a configured database while liveness stays healthy", async () => {
	app = await createApplication(readLocalConfig({ APP_ENV: "local" }));
	await app.init();
	await request(app.getHttpServer())
		.get("/health/ready")
		.expect(503)
		.expect({ status: "unavailable" });
	await request(app.getHttpServer()).get("/health/live").expect(200);
});

it("publishes health response contracts in local OpenAPI documentation", async () => {
	app = await createApplication(readLocalConfig({ APP_ENV: "local" }));
	await app.init();
	const response = await request(app.getHttpServer()).get("/docs-json").expect(200);
	expect(response.body.paths["/health/live"].get.responses).toHaveProperty("200");
	expect(response.body.paths["/health/ready"].get.responses).toHaveProperty("503");
});

it("returns bounded request correlation and an instance identifier", async () => {
	app = await createApplication(readLocalConfig({ APP_ENV: "local", API_INSTANCE_ID: "api-test" }));
	await app.init();
	const response = await request(app.getHttpServer())
		.get("/health/live")
		.set("X-Request-Id", "smoke-123")
		.expect(200);
	expect(response.headers["x-request-id"]).toBe("smoke-123");
	expect(response.headers["x-api-instance"]).toBe("api-test");
	const invalid = await request(app.getHttpServer())
		.get("/health/live")
		.set("X-Request-Id", "x".repeat(200))
		.expect(200);
	expect(invalid.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
});
