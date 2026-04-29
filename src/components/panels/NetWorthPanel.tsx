import { useMemo } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useMonthlySpendTrend } from "../../hooks/useMonthlySpendTrend";
import { useAuth } from "../../providers/AuthProvider";
import { computeNetWorth } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import { MonthlySpendTrend } from "../overview/MonthlySpendTrend";

export function NetWorthPanel() {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const today = useMemo(() => new Date(), []);

	const { accounts, isLoading: aLoading } = useAccounts();
	const { trend, isLoading: tLoading } = useMonthlySpendTrend(today, tz);

	const net = useMemo(() => computeNetWorth(accounts), [accounts]);

	return (
		<div className="card bg-base-100 h-full flex flex-col">
			<div className="card-body gap-4 flex-1">
				<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
					Net Worth
				</h2>

				{aLoading ? (
					<div className="flex justify-center py-4">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : (
					<>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<p className="text-xs text-base-content/40">Assets</p>
								<p className="text-lg font-semibold tabular-nums">
									{formatCentavos(net.assetsCentavos)}
								</p>
							</div>
							<div>
								<p className="text-xs text-base-content/40">Liabilities</p>
								<p className="text-lg font-semibold tabular-nums text-error">
									{formatCentavos(net.liabilitiesCentavos)}
								</p>
							</div>
							<div>
								<p className="text-xs text-base-content/40">Net Worth</p>
								<p
									className={`text-lg font-semibold tabular-nums ${
										net.netWorthCentavos < 0 ? "text-error" : ""
									}`}
								>
									{formatCentavos(net.netWorthCentavos)}
								</p>
							</div>
						</div>

						{!tLoading && (
							<div className="flex-1 min-h-0">
								<MonthlySpendTrend data={trend} isLoading={tLoading} />
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
