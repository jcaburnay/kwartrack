import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionAccountCell } from "../components/transactions/TransactionAccountCell";

const accountsById = new Map([
	["a1", "BPI Card"],
	["a2", "BDO Savings"],
]);

describe("TransactionAccountCell", () => {
	it("renders source for expense", () => {
		const { container } = render(
			<TransactionAccountCell
				type="expense"
				fromAccountId="a1"
				toAccountId={null}
				accountsById={accountsById}
			/>,
		);
		expect(container.textContent).toBe("BPI Card");
	});

	it("renders destination for income", () => {
		const { container } = render(
			<TransactionAccountCell
				type="income"
				fromAccountId={null}
				toAccountId="a2"
				accountsById={accountsById}
			/>,
		);
		expect(container.textContent).toBe("BDO Savings");
	});

	it("renders 'from → to' for transfer", () => {
		const { container } = render(
			<TransactionAccountCell
				type="transfer"
				fromAccountId="a1"
				toAccountId="a2"
				accountsById={accountsById}
			/>,
		);
		expect(container.textContent).toBe("BPI Card → BDO Savings");
	});

	it("falls back to em-dash when account id is unknown", () => {
		const { container } = render(
			<TransactionAccountCell
				type="expense"
				fromAccountId="missing"
				toAccountId={null}
				accountsById={accountsById}
			/>,
		);
		expect(container.textContent).toBe("—");
	});

	it("renders nothing meaningful when ids are null", () => {
		const { container } = render(
			<TransactionAccountCell
				type="expense"
				fromAccountId={null}
				toAccountId={null}
				accountsById={accountsById}
			/>,
		);
		expect(container.textContent).toBe("—");
	});
});
