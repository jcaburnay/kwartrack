import type { Account } from "../../utils/accountBalances";
import { creditUtilization } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	account: Account;
	onPayThisCard: () => void;
};

function pctClass(pct: number): string {
	if (pct > 1) return "progress-error";
	if (pct >= 0.8) return "progress-warning";
	return "progress-success";
}

export function CreditAccountStrip({ account, onPayThisCard }: Props) {
	const utilization = creditUtilization(account);
	if (!utilization) return null;
	const { utilizedCentavos, limitCentavos, utilizationPct } = utilization;
	const available = Math.max(0, limitCentavos - utilizedCentavos);
	const utilPctText = Math.round(utilizationPct * 100);
	const utilPctBar = Math.min(100, utilPctText);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-3xl font-semibold tabular-nums text-error">
				{formatCentavos(utilizedCentavos)}{" "}
				<span className="text-base text-base-content/50">owed</span>
			</p>

			<dl className="flex flex-col gap-1.5 text-sm">
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Available</dt>
					<dd className="tabular-nums">{formatCentavos(available)}</dd>
				</div>
			</dl>

			<div className="flex flex-col gap-1">
				<div className="flex justify-between text-xs text-base-content/60">
					<span>
						Utilization · {formatCentavos(utilizedCentavos)} / {formatCentavos(limitCentavos)}
					</span>
					<span>{utilPctText}%</span>
				</div>
				<progress className={`progress ${pctClass(utilizationPct)}`} value={utilPctBar} max="100" />
			</div>

			<div className="flex justify-end">
				<button type="button" className="btn btn-sm btn-primary" onClick={onPayThisCard}>
					Pay this card
				</button>
			</div>
		</div>
	);
}
