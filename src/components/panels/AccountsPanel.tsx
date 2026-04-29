import { useMemo } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useTransactions } from "../../hooks/useTransactions";
import { computeNetWorth } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = { onSeeAll: () => void };

export function AccountsPanel({ onSeeAll }: Props) {
	const { accounts, isLoading: aLoading } = useAccounts();
	const { transactions, isLoading: tLoading } = useTransactions();

	const net = useMemo(() => computeNetWorth(accounts), [accounts]);
	const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

	const isLoading = aLoading || tLoading;

	return (
		<div className="card bg-base-100 h-full flex flex-col">
			<div className="card-body gap-4 flex-1">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
						Accounts
					</h2>
					<button type="button" className="text-xs text-primary hover:underline" onClick={onSeeAll}>
						See all →
					</button>
				</div>

				{isLoading ? (
					<div className="flex justify-center py-4">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : (
					<>
						<div className="space-y-1">
							{accounts.slice(0, 4).map((a) => (
								<div key={a.id} className="flex items-center justify-between py-1">
									<span className="text-sm truncate">{a.name}</span>
									<span className="text-sm tabular-nums font-medium ml-4">
										{formatCentavos(a.balance_centavos)}
									</span>
								</div>
							))}
							{accounts.length === 0 && (
								<p className="text-sm text-base-content/50">No accounts yet</p>
							)}
						</div>

						<div className="divider my-0" />

						<div>
							<p className="text-xs text-base-content/50 mb-2">Recent transactions</p>
							<div className="space-y-1">
								{recent.map((t) => (
									<div key={t.id} className="flex items-center justify-between py-0.5">
										<span className="text-sm truncate text-base-content/80">
											{t.description ?? "—"}
										</span>
										<span
											className={`text-sm tabular-nums ml-4 ${
												t.type === "income"
													? "text-success"
													: t.type === "expense"
														? "text-base-content"
														: "text-base-content/60"
											}`}
										>
											{t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
											{formatCentavos(Math.abs(t.amount_centavos))}
										</span>
									</div>
								))}
								{recent.length === 0 && (
									<p className="text-sm text-base-content/50">No transactions yet</p>
								)}
							</div>
						</div>

						<div className="mt-auto pt-2 border-t border-base-200">
							<div className="flex justify-between text-xs text-base-content/50">
								<span>Net Worth</span>
								<span className="tabular-nums font-medium text-base-content">
									{formatCentavos(net.netWorthCentavos)}
								</span>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
