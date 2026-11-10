import { describe, expect, it } from "vitest";
import { readLocalConfig } from "../dist/config/local-config.js";

describe("local configuration", () => {
	it("supports dependency-free startup with explicit local mode", () => {
		const config = readLocalConfig({ APP_ENV: "local" });
		expect(config.host).toBe("127.0.0.1");
		expect(config.port).toBe(3000);
		expect(config.databaseUrl).toBeUndefined();
		expect(config.awsEndpoint).toBe("http://127.0.0.1:4566");
	});

	it("accepts separate host and container endpoints", () => {
		const config = readLocalConfig({
			APP_ENV: "local",
			API_HOST: "0.0.0.0",
			API_PORT: "3001",
			AWS_ENDPOINT_URL: "http://floci:4566",
			DATABASE_URL: "postgresql://test:test@floci:7001/kwartrack_api",
		});
		expect(config.host).toBe("0.0.0.0");
		expect(config.port).toBe(3001);
		expect(config.databaseUrl).toBe("postgresql://test:test@floci:7001/kwartrack_api");
	});

	it.each([
		{},
		{ APP_ENV: "production" },
		{ API_PORT: "0" },
		{ API_PORT: "3.5" },
		{ API_HOST: "example.com" },
		{ AWS_ENDPOINT_URL: "https://rds.us-east-1.amazonaws.com" },
		{ AWS_ENDPOINT_URL: "http://floci.attacker.example:4566" },
		{ AWS_PROFILE: "default" },
		{ AWS_SESSION_TOKEN: "secret" },
		{ AWS_ACCESS_KEY_ID: "real-key" },
		{ DATABASE_URL: "postgresql://test:secret@hosted.example/kwartrack_api" },
		{ DATABASE_URL: "postgresql://test:secret@127.0.0.1:54322/postgres" },
		{ DATABASE_URL: "postgresql://test:secret@127.0.0.1:7001/kwartrack_api?host=remote" },
		{ DATABASE_URL: "https://127.0.0.1:7001/kwartrack_api" },
		{ DATABASE_URL: "not a URL" },
	])("rejects unsafe or malformed settings without leaking values: %j", (overrides) => {
		const env = "APP_ENV" in overrides ? overrides : { APP_ENV: "local", ...overrides };
		// The empty case specifically exercises absent explicit local mode.
		const input = Object.keys(overrides).length === 0 ? {} : env;
		expect(() => readLocalConfig(input)).toThrow();
		try {
			readLocalConfig(input);
		} catch (error) {
			expect(String(error)).not.toContain("secret");
			expect(String(error)).not.toContain("real-key");
			expect(String(error)).not.toContain("hosted.example");
		}
	});
});
