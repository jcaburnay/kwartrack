import { useMemo, useState } from "react";
import { useAccounts } from "../../hooks/useAccounts";
import { useCashFlowTrend } from "../../hooks/useCashFlowTrend";
import { useMtdDelta } from "../../hooks/useMtdDelta";
import { useNetWorthTrend } from "../../hooks/useNetWorthTrend";
import { useAuth } from "../../providers/AuthProvider";
import { computeNetWorth } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import {
	accountsByBalance,
	assetMixByType,
	liabilitiesByType,
} from "../../utils/netWorthAggregation";
import { AccountBalancesBar } from "../overview/AccountBalancesBar";
import { AssetMix } from "../overview/AssetMix";
import { CashFlowTrend } from "../overview/CashFlowTrend";
import {
	ChartRangeToggle,
	type RangeOption,
	rangeToMonthCount,
} from "../overview/ChartRangeToggle";
import { NetWorthTrend } from "../overview/NetWorthTrend";

type ChartView = "netWorth" | "cashFlow" | "assetMix" | "accountBalances";

const CHART_OPTIONS: { value: ChartView; label: string }[] = [
	{ value: "netWorth", label: "Trend" },
	{ value: "cashFlow", label: "Cash Flow" },
	{ value: "assetMix", label: "Asset Mix" },
	{ value: "accountBalances", label: "Balances" },
];

const SIGNIFICANT_DROP_RATIO = 0.02;

function formatMtdDelta(centavos: number): string {
	const sign = centavos >= 0 ? "+" : "−";
	const abs = formatCentavos(Math.abs(centavos));
	return `${sign}${abs} this month`;
}

export function NetWorthPanel() {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const today = useMemo(() => new Date(), []);

	const { accounts, isLoading: aLoading } = useAccounts();
	const net = useMemo(() => computeNetWorth(accounts), [accounts]);
	const { deltaCentavos, percentOfCurrent } = useMtdDelta(today, tz);

	const [chart, setChart] = useState<ChartView>("netWorth");
	const [range, setRange] = useState<RangeOption>("12m");
	const monthCount = rangeToMonthCount(range);

	const { trend: nwTrend, isLoading: nwLoading } = useNetWorthTrend(today, tz, monthCount);
	const { trend: cfTrend, isLoading: cfLoading } = useCashFlowTrend(today, tz, monthCount);

	const assetSlices = useMemo(() => assetMixByType(accounts), [accounts]);
	const liabilitySlices = useMemo(() => liabilitiesByType(accounts), [accounts]);
	const balanceRows = useMemo(() => accountsByBalance(accounts), [accounts]);

	const isTimeAxis = chart === "netWorth" || chart === "cashFlow";
	const showDelta = !aLoading && deltaCentavos !== 0;
	const isSignificantDrop = deltaCentavos < 0 && percentOfCurrent < -SIGNIFICANT_DROP_RATIO;

	return (
		<div className="bg-base-100 h-full flex flex-col min-w-0">
			<div className="card-body gap-4 flex-1 min-w-0">
				<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
					Net Worth
				</h2>

				{aLoading ? (
					<div className="flex justify-center py-4">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : (
					<>
						<dl className="space-y-1.5">
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-xs text-base-content/60">Assets</dt>
								<dd className="text-base font-semibold tabular-nums">
									{formatCentavos(net.assetsCentavos)}
								</dd>
							</div>
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-xs text-base-content/60">Liabilities</dt>
								<dd className="text-base font-semibold tabular-nums">
									{formatCentavos(net.liabilitiesCentavos)}
								</dd>
							</div>
							<div className="flex items-baseline justify-between gap-3 border-t border-base-200 pt-1.5">
								<dt className="text-xs font-medium text-base-content/70 whitespace-nowrap">
									Net Worth
								</dt>
								<dd
									className={`text-lg font-semibold tabular-nums ${
										net.netWorthCentavos < 0 ? "text-error" : ""
									}`}
								>
									{formatCentavos(net.netWorthCentavos)}
								</dd>
							</div>
							{showDelta && (
								<div className="flex justify-end">
									<span
										className={`text-xs tabular-nums ${
											isSignificantDrop ? "text-error" : "text-base-content/60"
										}`}
									>
										{formatMtdDelta(deltaCentavos)}
									</span>
								</div>
							)}
						</dl>

						<div className="flex items-center justify-between gap-2">
							<select
								aria-label="Chart view"
								className="select select-sm select-ghost text-xs px-2 -mx-2 max-w-[10rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								value={chart}
								onChange={(e) => setChart(e.target.value as ChartView)}
							>
								{CHART_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
							{isTimeAxis && <ChartRangeToggle value={range} onChange={setRange} />}
						</div>

						<div className="flex-1 min-h-0 min-w-0">
							{chart === "netWorth" && <NetWorthTrend data={nwTrend} isLoading={nwLoading} />}
							{chart === "cashFlow" && <CashFlowTrend data={cfTrend} isLoading={cfLoading} />}
							{chart === "assetMix" && (
								<AssetMix assets={assetSlices} liabilities={liabilitySlices} isLoading={false} />
							)}
							{chart === "accountBalances" && (
								<AccountBalancesBar rows={balanceRows} isLoading={false} />
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
