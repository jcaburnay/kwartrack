import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FEATURES } from "../components/landing/content";
import { FeatureGrid } from "../components/landing/FeatureGrid";

describe("FeatureGrid", () => {
	it("renders every feature title", () => {
		render(<FeatureGrid />);
		for (const feature of FEATURES) {
			expect(screen.getByText(feature.title)).toBeInTheDocument();
		}
	});
});
