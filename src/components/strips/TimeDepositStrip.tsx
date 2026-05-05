import type { Account } from "../../utils/accountBalances";
import {
	daysToMaturity,
	estimatedTimeDepositValue,
	interestAccrued,
} from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	account: Account;
	onWithdrawMatured?: () => void;
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

export function TimeDepositStrip({ account, onWithdrawMatured }: Props) {
	if (account.type !== "time-deposit") return null;
	const accrued = interestAccrued(account) ?? 0;
	const days = daysToMaturity(account) ?? 0;
	const estimate = estimatedTimeDepositValue(account);

	return (
		<div className="flex flex-col gap-3">
			<div>
				<p className="text-3xl font-semibold tabular-nums">
					{formatCentavos(account.balance_centavos)}
				</p>
				<p className="text-xs text-success mt-0.5">+{formatCentavos(accrued)} accrued</p>
			</div>

			<dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Principal</dt>
					<dd className="tabular-nums">{formatCentavos(account.principal_centavos ?? 0)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Rate</dt>
					<dd className="tabular-nums">{formatRate(account.interest_rate_bps ?? 0)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Cadence</dt>
					<dd>{formatInterval(account.interest_posting_interval)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Days to mat.</dt>
					<dd className="tabular-nums">{days > 0 ? days : "—"}</dd>
				</div>
				<div className="flex items-center justify-between gap-3 col-span-2">
					<dt className="text-base-content/60">Maturity</dt>
					<dd className="tabular-nums">{account.maturity_date ?? "—"}</dd>
				</div>
				{estimate != null && (
					<div className="flex items-center justify-between gap-3 col-span-2">
						<dt className="text-base-content/60">Estimated</dt>
						<dd className="tabular-nums text-base-content/80">{formatCentavos(estimate)}</dd>
					</div>
				)}
			</dl>

			{account.is_matured && onWithdrawMatured && (
				<div className="flex justify-end">
					<button type="button" className="btn btn-sm btn-primary" onClick={onWithdrawMatured}>
						Withdraw matured balance
					</button>
				</div>
			)}
		</div>
	);
}
