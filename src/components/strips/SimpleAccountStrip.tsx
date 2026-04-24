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
		<section className="card bg-base-100 shadow-sm">
			<div className="card-body flex-col gap-4 p-5 sm:p-6">
				<header className="flex items-baseline justify-between gap-4 flex-wrap">
					<div>
						<p className="text-xs uppercase tracking-wide text-base-content/60">{account.name}</p>
						<p className="text-3xl font-semibold">{formatCentavos(account.balance_centavos)}</p>
					</div>
					<dl className="flex gap-6 text-sm text-base-content/70">
						<div>
							<dt className="text-xs uppercase tracking-wide text-base-content/60">
								This-month in
							</dt>
							<dd className="font-medium text-success">{formatCentavos(inflowCentavos)}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-base-content/60">
								This-month out
							</dt>
							<dd className="font-medium text-error">{formatCentavos(outflowCentavos)}</dd>
						</div>
					</dl>
				</header>
			</div>
		</section>
	);
}
