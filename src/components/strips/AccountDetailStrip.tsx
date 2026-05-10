import { X } from "lucide-react";
import type { Account } from "../../utils/accountBalances";
import type { Transaction } from "../../utils/transactionFilters";
import { CreditAccountStrip } from "./CreditAccountStrip";
import { SimpleAccountStrip } from "./SimpleAccountStrip";
import { TimeDepositStrip } from "./TimeDepositStrip";

type Props = {
	account: Account;
	transactions: readonly Transaction[];
	timezone: string;
	onClear: () => void;
	onPayThisCard: () => void;
	onWithdrawMatured: () => void;
};

export function AccountDetailStrip({
	account,
	transactions,
	timezone,
	onClear,
	onPayThisCard,
	onWithdrawMatured,
}: Props) {
	const showMatured = account.type === "time-deposit" && account.is_matured;

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-xs font-semibold uppercase tracking-wide text-base-content/60 truncate">
						{account.name}
					</span>
					{showMatured && <span className="badge badge-success badge-sm shrink-0">Matured</span>}
				</div>
				<button
					type="button"
					aria-label="Clear selection"
					className="btn btn-ghost btn-xs btn-circle"
					onClick={onClear}
				>
					<X className="size-3.5" />
				</button>
			</div>
			{account.type === "credit" && (
				<CreditAccountStrip account={account} onPayThisCard={onPayThisCard} />
			)}
			{account.type === "time-deposit" && (
				<TimeDepositStrip account={account} onWithdrawMatured={onWithdrawMatured} />
			)}
			{(account.type === "cash" || account.type === "e-wallet" || account.type === "savings") && (
				<SimpleAccountStrip account={account} transactions={transactions} timezone={timezone} />
			)}
		</div>
	);
}
