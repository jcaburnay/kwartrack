import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BankIcon } from "../components/BankIcon";

describe("BankIcon", () => {
	it("renders monogram from account name when no bankId given", () => {
		render(<BankIcon name="Cash Wallet" />);
		// First 2 chars uppercased
		expect(screen.getByText("CA")).toBeInTheDocument();
	});

	it("renders bank abbr when bankId matches a known bank", () => {
		render(<BankIcon bankId="bdo" name="BDO Account" />);
		// BDO entry abbr is "BDO"
		expect(screen.getByText("BDO")).toBeInTheDocument();
	});

	it("renders monogram for unknown bankId", () => {
		render(<BankIcon bankId="unknown-xyz" name="Mystery Bank" />);
		// Falls back to first 2 chars of name
		expect(screen.getByText("MY")).toBeInTheDocument();
	});

	it("applies the size prop to width and height", () => {
		const { container } = render(<BankIcon name="Test" size={40} />);
		const el = container.firstChild as HTMLElement;
		expect(el.style.width).toBe("40px");
		expect(el.style.height).toBe("40px");
	});
});
