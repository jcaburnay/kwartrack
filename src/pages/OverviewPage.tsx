import { useMemo } from "react";
import { Link } from "react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";
import { getAccountBackground } from "../utils/brandColors";
import { getCurrentMonthExpenses } from "../utils/budgetCompute";
import { formatPesos } from "../utils/currency";
import {
	computeAccountSummaries,
	computeMonthlyTrend,
	computeSpendingByTag,
	computeTotalBalance,
} from "../utils/dashboardCompute";

function getMonthHeading(): string {
	return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(new Date());
}

export function OverviewPage() {
	const [accounts, isAccountsReady] = useTable(tables.my_accounts);
	const [subAccounts, isSubAccountsReady] = useTable(tables.my_sub_accounts);
	const [transactions, isTransactionsReady] = useTable(tables.my_transactions);
	const [budgetConfigRows, isBudgetReady] = useTable(tables.my_budget_config);

	const isReady = isAccountsReady && isSubAccountsReady && isTransactionsReady && isBudgetReady;

	// Memoize expensive computations — these run O(n) or O(n*6) over transactions/subAccounts
	const totalBalance = useMemo(() => computeTotalBalance(subAccounts), [subAccounts]);
	const accountSummaries = useMemo(
		() => computeAccountSummaries(accounts, subAccounts),
		[accounts, subAccounts],
	);
	const spentByTag = useMemo(() => getCurrentMonthExpenses(transactions), [transactions]);
	const totalSpentCentavos = useMemo(
		() => [...spentByTag.values()].reduce((sum, v) => sum + v, 0n),
		[spentByTag],
	);
	const spendingByTag = useMemo(() => computeSpendingByTag(transactions), [transactions]);
	const monthlyTrend = useMemo(() => computeMonthlyTrend(transactions, 6), [transactions]);

	if (!isReady) return null;

	const budgetConfig = budgetConfigRows[0] ?? null;
	const budgetTotal = budgetConfig?.totalCentavos ?? 0n;
	const budgetPct =
		budgetTotal > 0n ? Math.round(Number((totalSpentCentavos * 100n) / budgetTotal)) : 0;
	const budgetRemaining = budgetTotal - totalSpentCentavos;

	const barColor =
		budgetPct >= 100 ? "#ef4444" : budgetPct >= 80 ? "#d97706" : "oklch(62% 0.12 180)";

	return (
		<div className="p-4 sm:p-6 animate-card-enter">
			{/* Section header */}
			<h1 className="text-xs font-medium tracking-widest text-base-content/35 uppercase mb-5">
				Overview
			</h1>

			{/* Hero: Total Net Balance */}
			<div className="mb-8 animate-card-enter">
				<span className="text-xs text-base-content/40 uppercase tracking-widest">
					Total Balance
				</span>
				<div
					className={`text-3xl sm:text-4xl font-bold font-mono mt-0.5 ${
						totalBalance >= 0n ? "text-success" : "text-error"
					}`}
				>
					{formatPesos(totalBalance)}
				</div>
				<span className="text-xs text-base-content/40">
					across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Two-column grid */}
			<div className="grid lg:grid-cols-2 gap-5">
				{/* LEFT column */}
				<div className="flex flex-col gap-5">
					{/* Account Summary Cards */}
					<div className="animate-card-enter" style={{ animationDelay: `0.06s` }}>
						<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
							Accounts
						</h2>
						{accountSummaries.length === 0 ? (
							<p className="text-sm text-base-content/50">
								No accounts yet &middot;{" "}
								<Link to="/accounts" className="text-primary hover:underline">
									Add one
								</Link>
							</p>
						) : (
							<div className="overflow-visible">
								<table className="table table-sm w-full">
									<thead>
										<tr className="bg-base-200">
											<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
												ACCOUNT
											</th>
											<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase text-right">
												BALANCE
											</th>
										</tr>
									</thead>
									<tbody>
										{accountSummaries.map((acct) => (
											<tr key={String(acct.id)} className="hover">
												<td>
													<Link
														to={`/accounts/${acct.id}`}
														className="link link-hover text-sm font-semibold flex items-center gap-2"
													>
														<span
															className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-base-content/15"
															style={{ background: getAccountBackground(acct.name) }}
														/>
														{acct.name}
													</Link>
												</td>
												<td className="text-right">
													<span
														className={`font-mono text-sm font-semibold ${
															acct.balanceCentavos >= 0n ? "text-success" : "text-error"
														}`}
													>
														{formatPesos(acct.balanceCentavos)}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>

					{/* Budget Summary */}
					<div className="animate-card-enter" style={{ animationDelay: `0.12s` }}>
						<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
							Budget This Month
						</h2>
						{budgetTotal === 0n ? (
							<p className="text-sm text-base-content/50">
								No budget set &middot;{" "}
								<Link to="/budget" className="text-primary hover:underline">
									Set one
								</Link>
							</p>
						) : (
							<div className="bg-base-100 shadow-sm border border-base-300/50 rounded-xl p-3.5">
								<div className="flex items-baseline justify-between mb-2">
									<span className="text-xl font-bold font-mono">
										{formatPesos(totalSpentCentavos)}
									</span>
									<span className="text-xs text-base-content/40">
										of {formatPesos(budgetTotal)}
									</span>
								</div>
								<div className="bg-base-200/50 rounded-full h-2.5 overflow-hidden mb-2">
									<div
										className="h-full rounded-full transition-all"
										style={{
											width: `${Math.min(budgetPct, 100)}%`,
											background: barColor,
										}}
									/>
								</div>
								<p className="text-xs text-base-content/50">
									{budgetPct}% spent &middot; {formatPesos(budgetRemaining)} remaining
								</p>
							</div>
						)}
					</div>
				</div>

				{/* RIGHT column */}
				<div className="flex flex-col gap-5">
					{/* Spending by Category (DASH-03) */}
					<div className="animate-card-enter" style={{ animationDelay: `0.18s` }}>
						<SpendingByCategoryChart spending={spendingByTag} />
					</div>

					{/* Monthly Trend (DASH-04) */}
					<div className="animate-card-enter" style={{ animationDelay: `0.24s` }}>
						<MonthlyTrendChart trend={monthlyTrend} />
					</div>
				</div>
			</div>
		</div>
	);
}

// --- Chart Components ---

const TAG_PALETTE = [
	"oklch(62% 0.12 180)",
	"oklch(65% 0.14 40)",
	"oklch(55% 0.12 290)",
	"oklch(64% 0.17 155)",
	"oklch(62% 0.1 240)",
];

interface SpendingByCategoryChartProps {
	spending: { tag: string; amountCentavos: bigint }[];
}

function SpendingByCategoryChart({ spending }: SpendingByCategoryChartProps) {
	const top5 = spending.slice(0, 5);
	const remaining = spending.slice(5);
	const remainingTotal = remaining.reduce((sum, s) => sum + s.amountCentavos, 0n);
	const maxAmount = top5.length > 0 ? top5[0].amountCentavos : 0n;

	return (
		<div>
			<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
				Spending by Category
			</h2>
			<div className="bg-base-100 shadow-sm border border-base-300/50 rounded-xl p-3.5">
				<p className="text-xs text-base-content/40 mb-3">{getMonthHeading()}</p>
				{spending.length === 0 ? (
					<p className="text-sm text-base-content/50 py-4 text-center">No expenses this month</p>
				) : (
					<div className="flex flex-col gap-2.5">
						{top5.map((item, i) => {
							const barWidth =
								maxAmount > 0n ? (Number(item.amountCentavos) / Number(maxAmount)) * 100 : 0;
							return (
								<div key={item.tag}>
									<div className="flex items-center justify-between mb-0.5">
										<span className="text-sm capitalize">{item.tag.replace(/-/g, " ")}</span>
										<span className="text-xs font-mono text-base-content/60">
											{formatPesos(item.amountCentavos)}
										</span>
									</div>
									<div className="bg-base-200/50 rounded-full h-2 overflow-hidden">
										<div
											className="h-full rounded-full"
											style={{
												width: `${barWidth}%`,
												background: TAG_PALETTE[i % TAG_PALETTE.length],
											}}
										/>
									</div>
								</div>
							);
						})}
						{remaining.length > 0 && (
							<div className="flex items-center justify-between text-xs text-base-content/40">
								<span>+ {remaining.length} more</span>
								<span className="font-mono">{formatPesos(remainingTotal)}</span>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

interface MonthlyTrendChartProps {
	trend: { month: string; label: string; incomeCentavos: bigint; expensesCentavos: bigint }[];
}

interface TrendChartDatum {
	label: string;
	income: number;
	expenses: number;
}

function MonthlyTrendChart({ trend }: MonthlyTrendChartProps) {
	const hasData = trend.some((m) => m.incomeCentavos > 0n || m.expensesCentavos > 0n);

	// Convert bigint centavos to number pesos at chart boundary
	const chartData: TrendChartDatum[] = trend.map((m) => ({
		label: m.label,
		income: Number(m.incomeCentavos) / 100,
		expenses: Number(m.expensesCentavos) / 100,
	}));

	return (
		<div>
			<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-2">
				Monthly Trend
			</h2>
			<div className="bg-base-100 shadow-sm border border-base-300/50 rounded-xl p-3.5">
				{!hasData ? (
					<p className="text-sm text-base-content/50 py-4 text-center">
						Not enough data for trends
					</p>
				) : (
					<>
						{/* Inline legend */}
						<div className="flex items-center gap-4 mb-2">
							<div className="flex items-center gap-1.5">
								<div className="w-3 h-0.5 rounded-full" style={{ background: "#4ade80" }} />
								<span className="text-xs text-base-content/50">Income</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-3 h-0.5 rounded-full" style={{ background: "#f87171" }} />
								<span className="text-xs text-base-content/50">Expenses</span>
							</div>
						</div>
						<ResponsiveContainer width="100%" height={180}>
							<LineChart data={chartData}>
								<CartesianGrid horizontal vertical={false} stroke="oklch(50% 0 0 / 0.1)" />
								<XAxis
									dataKey="label"
									axisLine={false}
									tickLine={false}
									tick={{ fontSize: 11, fill: "oklch(50% 0 0 / 0.4)" }}
								/>
								<Tooltip
									contentStyle={{
										background: "oklch(20% 0 0)",
										border: "none",
										borderRadius: "8px",
										fontSize: "12px",
									}}
									itemStyle={{ color: "oklch(90% 0 0)" }}
									formatter={(value) => {
										const numericValue = typeof value === "number" ? value : Number(value ?? 0);
										return `P${numericValue.toLocaleString("en-PH", {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}`;
									}}
								/>
								<Line
									type="monotone"
									dataKey="income"
									stroke="#4ade80"
									strokeWidth={2.5}
									dot={false}
									name="Income"
								/>
								<Line
									type="monotone"
									dataKey="expenses"
									stroke="#f87171"
									strokeWidth={2.5}
									dot={false}
									name="Expenses"
								/>
							</LineChart>
						</ResponsiveContainer>
					</>
				)}
			</div>
		</div>
	);
}
