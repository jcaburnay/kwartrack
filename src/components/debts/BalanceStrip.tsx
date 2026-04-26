import { formatCentavos } from "../../utils/currency";

type Props = { owedCentavos: number; oweCentavos: number };

export function BalanceStrip({ owedCentavos, oweCentavos }: Props) {
	return (
		<section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<div className="card bg-base-100 border border-base-300">
				<div className="card-body p-4">
					<p className="text-xs uppercase tracking-wide text-base-content/60">You're owed</p>
					<p className="text-xl font-semibold text-success">{formatCentavos(owedCentavos)}</p>
				</div>
			</div>
			<div className="card bg-base-100 border border-base-300">
				<div className="card-body p-4">
					<p className="text-xs uppercase tracking-wide text-base-content/60">You owe</p>
					<p
						className={`text-xl font-semibold ${oweCentavos > 0 ? "text-error" : "text-base-content"}`}
					>
						{formatCentavos(oweCentavos)}
					</p>
				</div>
			</div>
		</section>
	);
}
