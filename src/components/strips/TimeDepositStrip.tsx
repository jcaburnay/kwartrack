import type { Account } from "../../utils/accountBalances";
import {
	daysToMaturity,
	estimatedTimeDepositValue,
	interestAccrued,
} from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	account: Account;
};

function formatRate(bps: number): string {
	return `${(bps / 100).toFixed(2)}% p.a.`;
}

function formatInterval(i: Account["interest_posting_interval"]): string {
	switch (i) {
		case "monthly":
			return "Posts monthly";
		case "quarterly":
			return "Posts quarterly";
		case "semi-annual":
			return "Posts semi-annually";
		case "annual":
			return "Posts annually";
		case "at-maturity":
			return "Posts at maturity";
		default:
			return "—";
	}
}

export function TimeDepositStrip({ account }: Props) {
	if (account.type !== "time-deposit") return null;
	const accrued = interestAccrued(account) ?? 0;
	const days = daysToMaturity(account) ?? 0;
	const estimate = estimatedTimeDepositValue(account);

	return (
		<section className="card bg-base-100 shadow-sm">
			<div className="card-body flex-col gap-4 p-5 sm:p-6">
				<header className="flex items-baseline justify-between gap-4 flex-wrap">
					<div>
						<p className="text-xs uppercase tracking-wide text-base-content/60">
							{account.name}
							{account.is_matured && (
								<span className="badge badge-success badge-sm ml-2">Matured</span>
							)}
						</p>
						<p className="text-2xl font-semibold">{formatCentavos(account.balance_centavos)}</p>
					</div>
					<div className="text-sm text-base-content/70 text-right">
						<span className="text-success">+{formatCentavos(accrued)}</span>
						<span className="block text-xs">accrued</span>
					</div>
				</header>

				<dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
					<div>
						<dt className="text-xs text-base-content/60">Principal</dt>
						<dd>{formatCentavos(account.principal_centavos ?? 0)}</dd>
					</div>
					<div>
						<dt className="text-xs text-base-content/60">Rate</dt>
						<dd>{formatRate(account.interest_rate_bps ?? 0)}</dd>
					</div>
					<div>
						<dt className="text-xs text-base-content/60">Cadence</dt>
						<dd>{formatInterval(account.interest_posting_interval)}</dd>
					</div>
					<div>
						<dt className="text-xs text-base-content/60">Days to maturity</dt>
						<dd>{days > 0 ? days : "—"}</dd>
					</div>
					<div className="col-span-2 sm:col-span-2">
						<dt className="text-xs text-base-content/60">Maturity date</dt>
						<dd>{account.maturity_date ?? "—"}</dd>
					</div>
					{estimate != null && (
						<div className="col-span-2 sm:col-span-2">
							<dt className="text-xs text-base-content/60">Estimated at maturity</dt>
							<dd className="text-base-content/80">{formatCentavos(estimate)}</dd>
						</div>
					)}
				</dl>
			</div>
		</section>
	);
}
