import { describe, expect, it } from "vitest";
import {
	DOCS_URL,
	FEATURES,
	GITHUB_URL,
	HEADLINE,
	SELF_HOST_URL,
} from "../components/landing/content";

describe("landing content", () => {
	it("points at the public repo", () => {
		expect(GITHUB_URL).toBe("https://github.com/jcaburnay/kwartrack");
	});

	it("targets the README self-hosting anchor", () => {
		expect(SELF_HOST_URL).toBe("https://github.com/jcaburnay/kwartrack#self-hosting");
	});

	it("lists exactly six features with copy", () => {
		expect(FEATURES).toHaveLength(6);
		for (const feature of FEATURES) {
			expect(feature.title.length).toBeGreaterThan(0);
			expect(feature.body.length).toBeGreaterThan(0);
			expect(typeof feature.icon).toBe("object");
		}
	});

	it("pins the docs link and headline", () => {
		expect(DOCS_URL).toBe("https://github.com/jcaburnay/kwartrack/blob/main/specs.md");
		expect(HEADLINE).toBe("Every peso, clearly tracked.");
	});
});
