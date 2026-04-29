import type { TransactionType } from "../../utils/transactionValidation";

type Props = {
	type: TransactionType;
	fromAccountId: string | null;
	toAccountId: string | null;
	accountsById: ReadonlyMap<string, string>;
};

const ARROW = "→"; // U+2192
const DASH = "—"; // U+2014

function name(id: string | null, lookup: ReadonlyMap<string, string>): string | null {
	if (!id) return null;
	return lookup.get(id) ?? null;
}

export function TransactionAccountCell({ type, fromAccountId, toAccountId, accountsById }: Props) {
	if (type === "transfer") {
		const from = name(fromAccountId, accountsById);
		const to = name(toAccountId, accountsById);
		if (!from && !to) return <span className="text-base-content/40">{DASH}</span>;
		return (
			<span className="truncate inline-block max-w-full">
				{from ?? DASH} {ARROW} {to ?? DASH}
			</span>
		);
	}

	const id = type === "expense" ? fromAccountId : toAccountId;
	const display = name(id, accountsById);
	if (!display) return <span className="text-base-content/40">{DASH}</span>;
	return <span className="truncate inline-block max-w-full">{display}</span>;
}
