import { lazy, Suspense, useMemo, useState } from "react";
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
import {
	ChartRangeToggle,
	type RangeOption,
	rangeToMonthCount,
} from "../overview/ChartRangeToggle";
import { DropdownSelect } from "../ui/DropdownSelect";

const NetWorthTrend = lazy(() =>
	import("../overview/NetWorthTrend").then((m) => ({ default: m.NetWorthTrend })),
);
const CashFlowTrend = lazy(() =>
	import("../overview/CashFlowTrend").then((m) => ({ default: m.CashFlowTrend })),
);
const AssetMix = lazy(() => import("../overview/AssetMix").then((m) => ({ default: m.AssetMix })));
const AccountBalancesBar = lazy(() =>
	import("../overview/AccountBalancesBar").then((m) => ({ default: m.AccountBalancesBar })),
);

function ChartSkeleton() {
	return <div className="skeleton h-full w-full" />;
}

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
		<div className="bg-base-100 border border-base-300 h-full flex flex-col min-w-0">
			<div className="h-9 flex items-center px-4 border-b border-base-300 flex-shrink-0">
				<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
					Net Worth
				</span>
			</div>
			<div className="flex-1 min-w-0 p-4 flex flex-col gap-4">
				{aLoading ? (
					<div className="flex-1 flex items-center justify-center">
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
							<DropdownSelect
								ariaLabel="Chart view"
								value={chart}
								options={CHART_OPTIONS}
								onChange={setChart}
							/>
							{isTimeAxis && <ChartRangeToggle value={range} onChange={setRange} />}
						</div>

						<div className="flex-1 min-h-0 min-w-0">
							<Suspense fallback={<ChartSkeleton />}>
								{chart === "netWorth" && <NetWorthTrend data={nwTrend} isLoading={nwLoading} />}
								{chart === "cashFlow" && <CashFlowTrend data={cfTrend} isLoading={cfLoading} />}
								{chart === "assetMix" && (
									<AssetMix assets={assetSlices} liabilities={liabilitySlices} isLoading={false} />
								)}
								{chart === "accountBalances" && (
									<AccountBalancesBar rows={balanceRows} isLoading={false} />
								)}
							</Suspense>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
