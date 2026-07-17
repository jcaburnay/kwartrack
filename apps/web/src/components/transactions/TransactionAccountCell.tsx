import { memo } from "react";
import type { TransactionType } from "../../utils/transactionValidation";

type Props = {
	type: TransactionType;
	fromAccountId: string | null;
	toAccountId: string | null;
	accountsById: ReadonlyMap<string, string>;
};

const ARROW = "→"; // U+2192
const DASH = "—"; // U+2014

function lookupAccountName(id: string | null, lookup: ReadonlyMap<string, string>): string | null {
	if (!id) return null;
	return lookup.get(id) ?? null;
}

function MissingName() {
	return <span className="text-base-content/40">{DASH}</span>;
}

function TransactionAccountCellInner({ type, fromAccountId, toAccountId, accountsById }: Props) {
	if (type === "transfer") {
		const from = lookupAccountName(fromAccountId, accountsById);
		const to = lookupAccountName(toAccountId, accountsById);
		if (!from && !to) return <MissingName />;
		return (
			<>
				{from ?? <span className="text-base-content/40">{DASH}</span>} {ARROW}{" "}
				{to ?? <span className="text-base-content/40">{DASH}</span>}
			</>
		);
	}

	const id = type === "expense" ? fromAccountId : toAccountId;
	const display = lookupAccountName(id, accountsById);
	if (!display) return <MissingName />;
	return <>{display}</>;
}

export const TransactionAccountCell = memo(TransactionAccountCellInner);
