import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../App";

describe("App", () => {
	it("renders the v2 scaffold placeholder", () => {
		render(<App />);
		expect(screen.getByRole("heading", { name: /kwartrack v2/i })).toBeInTheDocument();
	});
});
