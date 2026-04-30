import { useMemo } from "react";
import { useDebtsAndSplits } from "../../hooks/useDebtsAndSplits";
import { formatCentavos } from "../../utils/currency";

type Props = { onSeeAll: () => void };

export function DebtsPanel({ onSeeAll }: Props) {
	const { debts, balance, isLoading } = useDebtsAndSplits();

	const unsettled = useMemo(
		() => debts.filter((d) => d.settledCentavos < d.amountCentavos).slice(0, 5),
		[debts],
	);

	const hasBalance = balance.owedCentavos > 0 || balance.oweCentavos > 0;

	return (
		<div className="bg-base-100 border border-base-300 h-full flex flex-col">
			<div className="card-body gap-4 flex-1">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
						Debts & Splits
					</h2>
					<button
						type="button"
						aria-label="View all debts and splits"
						className="text-xs text-primary hover:underline rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						onClick={onSeeAll}
					>
						See all →
					</button>
				</div>

				{isLoading ? (
					<div className="flex-1 flex items-center justify-center">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : (
					<>
						{hasBalance && (
							<div className="flex gap-4">
								{balance.owedCentavos > 0 && (
									<div>
										<p className="text-xs text-base-content/40">Owed to you</p>
										<p className="text-sm tabular-nums font-medium text-success">
											{formatCentavos(balance.owedCentavos)}
										</p>
									</div>
								)}
								{balance.oweCentavos > 0 && (
									<div>
										<p className="text-xs text-base-content/40">You owe</p>
										<p className="text-sm tabular-nums font-medium text-error">
											{formatCentavos(balance.oweCentavos)}
										</p>
									</div>
								)}
							</div>
						)}

						<div className="space-y-2">
							{unsettled.map((d) => (
								<div key={d.id} className="flex items-center justify-between py-0.5">
									<div className="min-w-0">
										<p className="text-sm truncate">{d.personName}</p>
										<p className="text-xs text-base-content/40">
											{d.direction === "loaned" ? "owes you" : "you owe"}
										</p>
									</div>
									<span
										className={`text-sm tabular-nums ml-4 ${
											d.direction === "loaned" ? "text-success" : "text-error"
										}`}
									>
										{formatCentavos(d.amountCentavos - d.settledCentavos)}
									</span>
								</div>
							))}
							{unsettled.length === 0 && !hasBalance && (
								<p className="text-sm text-base-content/60">
									No open debts. Splits and IOUs you create will appear here.
								</p>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
