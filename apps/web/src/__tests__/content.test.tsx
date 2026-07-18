import { describe, expect, it } from "vitest";
import { FEATURES, GITHUB_URL, SELF_HOST_URL } from "../components/landing/content";

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
});
