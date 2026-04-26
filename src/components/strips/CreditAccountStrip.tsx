import type { Account } from "../../utils/accountBalances";
import { creditInstallmentMetrics, creditUtilization } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { Recurring } from "../../utils/recurringFilters";

type Props = {
	account: Account;
	recurrings: readonly Recurring[];
	onPayThisCard: () => void;
};

function pctClass(pct: number): string {
	if (pct > 1) return "progress-error";
	if (pct >= 0.8) return "progress-warning";
	return "progress-success";
}

export function CreditAccountStrip({ account, recurrings, onPayThisCard }: Props) {
	const utilization = creditUtilization(account);
	if (!utilization) return null;
	const { utilizedCentavos, limitCentavos, utilizationPct } = utilization;
	// Spec §"Credit accounts" defines `availableCredit = creditLimit − (balance − installment-linked
	// portion)`. We don't track which posted transactions are installment-linked, so the
	// "installment-linked portion of balance" is treated as 0 here — already-posted installments
	// reduce regular available; the separate installment pool reflects only future commitments.
	// Refine if/when individual installment transactions become tagged.
	const available = Math.max(0, limitCentavos - utilizedCentavos);
	const utilPctText = Math.round(utilizationPct * 100);
	const utilPctBar = Math.min(100, utilPctText);

	const installment = creditInstallmentMetrics(account, recurrings);
	const installmentPctText = installment ? Math.round(installment.utilizationPct * 100) : 0;
	const installmentPctBar = Math.min(100, installmentPctText);

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
					<div className="text-right text-sm text-base-content/70 flex flex-col gap-0.5">
						<span>
							Available <strong className="text-base-content">{formatCentavos(available)}</strong>
						</span>
						{installment && (
							<span>
								Installment{" "}
								<strong className="text-base-content">
									{formatCentavos(installment.availableCentavos)}
								</strong>
							</span>
						)}
					</div>
				</header>

				<div className="flex flex-col gap-1">
					<div className="flex justify-between text-xs text-base-content/60">
						<span>
							Utilization · {formatCentavos(utilizedCentavos)} / {formatCentavos(limitCentavos)}
						</span>
						<span>{utilPctText}%</span>
					</div>
					<progress
						className={`progress ${pctClass(utilizationPct)}`}
						value={utilPctBar}
						max="100"
					/>
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
					<button type="button" className="btn btn-sm btn-primary" onClick={onPayThisCard}>
						Pay this card
					</button>
				</div>
			</div>
		</section>
	);
}
