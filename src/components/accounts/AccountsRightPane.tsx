import { Wallet } from "lucide-react";
import type { Selection } from "../../hooks/useSelectedAccount";
import type { Account } from "../../utils/accountBalances";
import type { Recurring } from "../../utils/recurringFilters";
import type { Transaction } from "../../utils/transactionFilters";
import { AccountDetailStrip } from "../strips/AccountDetailStrip";
import { GroupSummaryCard } from "../strips/GroupSummaryCard";

type Props = {
	selection: Selection;
	accounts: readonly Account[];
	transactions: readonly Transaction[];
	recurrings: readonly Recurring[];
	timezone: string;
	onClear: () => void;
	onPayThisCard: () => void;
	onWithdrawMatured: () => void;
};

export function AccountsRightPane({
	selection,
	accounts,
	transactions,
	recurrings,
	timezone,
	onClear,
	onPayThisCard,
	onWithdrawMatured,
}: Props) {
	if (selection.kind === "account") {
		return (
			<AccountDetailStrip
				account={selection.account}
				transactions={transactions}
				recurrings={recurrings}
				timezone={timezone}
				onClear={onClear}
				onPayThisCard={onPayThisCard}
				onWithdrawMatured={onWithdrawMatured}
			/>
		);
	}
	if (selection.kind === "group") {
		return <GroupSummaryCard group={selection.group} accounts={accounts} onClear={onClear} />;
	}
	return (
		<div className="flex flex-col items-center justify-center h-full gap-2 px-4 py-6">
			<Wallet className="size-6 text-base-content/30" />
			<p className="text-sm text-base-content/50 text-center">Select an account or group</p>
		</div>
	);
}
