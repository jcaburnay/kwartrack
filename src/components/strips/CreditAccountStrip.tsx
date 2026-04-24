import type { Account } from "../../utils/accountBalances";
import { creditUtilization } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	account: Account;
};

export function CreditAccountStrip({ account }: Props) {
	const utilization = creditUtilization(account);
	if (!utilization) return null;
	const { utilizedCentavos, limitCentavos, utilizationPct } = utilization;
	const available = Math.max(0, limitCentavos - utilizedCentavos);
	const pct = Math.min(100, Math.round(utilizationPct * 100));
	const pctColor =
		utilizationPct > 1
			? "progress-error"
			: utilizationPct >= 0.8
				? "progress-warning"
				: "progress-success";

	return (
		<section className="card bg-base-100 shadow-sm">
			<div className="card-body flex-col gap-4 p-5 sm:p-6">
				<header className="flex items-baseline justify-between gap-4 flex-wrap">
					<div>
						<p className="text-xs uppercase tracking-wide text-base-content/60">{account.name}</p>
						<p className="text-2xl font-semibold text-error">
							{formatCentavos(utilizedCentavos)}{" "}
							<span className="text-base-content/50 text-base">owed</span>
						</p>
					</div>
					<div className="text-sm text-base-content/70">
						Available <strong className="text-base-content">{formatCentavos(available)}</strong>
					</div>
				</header>

				<div className="flex flex-col gap-1">
					<div className="flex justify-between text-xs text-base-content/60">
						<span>Utilization</span>
						<span>{pct}%</span>
					</div>
					<progress className={`progress ${pctColor}`} value={pct} max="100" />
				</div>

				{account.installment_limit_centavos != null && (
					<div className="flex flex-col gap-1">
						<div className="flex justify-between text-xs text-base-content/60">
							<span>Installment (awaiting recurrings in a later slice)</span>
							<span>0%</span>
						</div>
						<progress
							className="progress progress-info"
							value={0}
							max={account.installment_limit_centavos || 1}
						/>
					</div>
				)}

				<div className="flex justify-end">
					<button
						type="button"
						className="btn btn-sm btn-primary"
						disabled
						title="Pay-this-card arrives with the Transactions slice"
					>
						Pay this card
					</button>
				</div>
			</div>
		</section>
	);
}
