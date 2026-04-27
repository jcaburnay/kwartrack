import type { Account } from "../../utils/accountBalances";
import type { Recurring } from "../../utils/recurringFilters";
import type { Transaction } from "../../utils/transactionFilters";
import { CreditAccountStrip } from "./CreditAccountStrip";
import { SimpleAccountStrip } from "./SimpleAccountStrip";
import { TimeDepositStrip } from "./TimeDepositStrip";

type Props = {
	account: Account;
	transactions: readonly Transaction[];
	recurrings: readonly Recurring[];
	timezone: string;
	onClear: () => void;
	onPayThisCard: () => void;
	onWithdrawMatured: () => void;
};

export function AccountDetailStrip({
	account,
	transactions,
	recurrings,
	timezone,
	onClear,
	onPayThisCard,
	onWithdrawMatured,
}: Props) {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span className="text-sm text-base-content/60">
					Selected: <strong className="text-base-content">{account.name}</strong>
				</span>
				<button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>
					Clear selection
				</button>
			</div>
			{account.type === "credit" && (
				<CreditAccountStrip
					account={account}
					recurrings={recurrings}
					transactions={transactions}
					onPayThisCard={onPayThisCard}
				/>
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
