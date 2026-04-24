import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeCard } from "../components/WelcomeCard";

describe("WelcomeCard", () => {
	it("renders the welcome heading and CTA", () => {
		render(<WelcomeCard />);
		expect(screen.getByRole("heading", { name: /welcome to kwartrack/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
	});
});
