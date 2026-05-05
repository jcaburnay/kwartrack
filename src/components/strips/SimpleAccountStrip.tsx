import type { Account } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { Transaction } from "../../utils/transactionFilters";
import { summariseThisMonth } from "../../utils/transactionSummary";

type Props = {
	account: Account;
	transactions: readonly Transaction[];
	timezone: string;
};

/** Simple strip for cash / e-wallet / savings accounts. */
export function SimpleAccountStrip({ account, transactions, timezone }: Props) {
	const { inflowCentavos, outflowCentavos } = summariseThisMonth(
		transactions,
		account.id,
		timezone,
	);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-3xl font-semibold tabular-nums">
				{formatCentavos(account.balance_centavos)}
			</p>
			<dl className="flex flex-col gap-1.5 text-sm">
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">This-month in</dt>
					<dd className="tabular-nums text-success">+{formatCentavos(inflowCentavos)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">This-month out</dt>
					<dd className="tabular-nums text-error">−{formatCentavos(outflowCentavos)}</dd>
				</div>
			</dl>
		</div>
	);
}
