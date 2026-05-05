import type { Account } from "../../utils/accountBalances";
import {
	creditInstallmentLinkedBalance,
	creditInstallmentMetrics,
	creditUtilization,
} from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { Recurring } from "../../utils/recurringFilters";
import type { Transaction } from "../../utils/transactionFilters";

type Props = {
	account: Account;
	recurrings: readonly Recurring[];
	transactions: readonly Transaction[];
	onPayThisCard: () => void;
};

function pctClass(pct: number): string {
	if (pct > 1) return "progress-error";
	if (pct >= 0.8) return "progress-warning";
	return "progress-success";
}

export function CreditAccountStrip({ account, recurrings, transactions, onPayThisCard }: Props) {
	const utilization = creditUtilization(account);
	if (!utilization) return null;
	const { utilizedCentavos, limitCentavos, utilizationPct } = utilization;
	// Spec §"Credit accounts" defines `availableCredit = creditLimit − (balance − installment-linked
	// portion)`. The installment-linked portion is the sum of posted installment expenses on this
	// card, clamped to balance — see `creditInstallmentLinkedBalance` for the attribution rule.
	const installmentLinked = creditInstallmentLinkedBalance(account, transactions);
	const available = Math.max(0, limitCentavos - (utilizedCentavos - installmentLinked));
	const utilPctText = Math.round(utilizationPct * 100);
	const utilPctBar = Math.min(100, utilPctText);

	const installment = creditInstallmentMetrics(account, recurrings);
	const installmentPctText = installment ? Math.round(installment.utilizationPct * 100) : 0;
	const installmentPctBar = Math.min(100, installmentPctText);

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
				{installment && (
					<div className="flex items-center justify-between gap-3">
						<dt className="text-base-content/60">Installment</dt>
						<dd className="tabular-nums">{formatCentavos(installment.availableCentavos)}</dd>
					</div>
				)}
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

			{installment && (
				<div className="flex flex-col gap-1">
					<div className="flex justify-between text-xs text-base-content/60">
						<span>
							Installment · {formatCentavos(installment.committedCentavos)} /{" "}
							{formatCentavos(installment.limitCentavos)}
						</span>
						<span>{installmentPctText}%</span>
					</div>
					<progress
						className={`progress ${pctClass(installment.utilizationPct)}`}
						value={installmentPctBar}
						max="100"
					/>
				</div>
			)}

			<div className="flex justify-end">
				<button type="button" className="btn btn-sm btn-cta" onClick={onPayThisCard}>
					Pay this card
				</button>
			</div>
		</div>
	);
}
