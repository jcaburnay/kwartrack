import { ChevronDown, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useTable } from "spacetimedb/react";
import { BudgetModal } from "../components/BudgetModal";
import { tables } from "../module_bindings";
import { computeTagStatuses, getCurrentMonthExpenses } from "../utils/budgetCompute";
import { formatPesos } from "../utils/currency";

const TAG_PALETTE = [
	"var(--color-primary)",
	"var(--color-secondary)",
	"var(--color-accent)",
	"var(--color-success)",
	"var(--color-info)",
];

function getTagColor(index: number): string {
	return TAG_PALETTE[index % TAG_PALETTE.length];
}

function getCardClass(pct: number): string {
	if (pct >= 100) return "bg-error/10";
	if (pct >= 80) return "bg-warning/10";
	return "bg-base-200/50";
}

function getBarColor(pct: number, tagColor: string): string {
	if (pct >= 100) return "var(--color-error)";
	if (pct >= 80) return "var(--color-warning)";
	return tagColor;
}

function getMonthHeading(): string {
	return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(new Date());
}

export function BudgetPage() {
	const [budgetConfigRows, isConfigReady] = useTable(tables.my_budget_config);
	const [allocations] = useTable(tables.my_budget_allocations);
	const [transactions] = useTable(tables.my_transactions);
	const [showModal, setShowModal] = useState(false);
	const [expandedTag, setExpandedTag] = useState<string | null>(null);

	// Memoize all spending computations — these iterate over all transactions
	const spentByTag = useMemo(() => getCurrentMonthExpenses(transactions), [transactions]);
	const tagStatuses = useMemo(
		() => computeTagStatuses(allocations, spentByTag),
		[allocations, spentByTag],
	);
	const sortedTagStatuses = useMemo(
		() => [...tagStatuses].sort((a, b) => b.percentUsed - a.percentUsed),
		[tagStatuses],
	);
	const totalSpentCentavos = useMemo(
		() => [...spentByTag.values()].reduce((sum, v) => sum + v, 0n),
		[spentByTag],
	);
	const allocatedTags = useMemo(() => new Set(allocations.map((a) => a.tag)), [allocations]);
	const otherSpentCentavos = useMemo(
		() =>
			[...spentByTag.entries()]
				.filter(([tag]) => !allocatedTags.has(tag))
				.reduce((sum, [, amount]) => sum + amount, 0n),
		[spentByTag, allocatedTags],
	);
	const colorByTag = useMemo(
		() => new Map(sortedTagStatuses.map((s, i) => [s.tag, getTagColor(i)])),
		[sortedTagStatuses],
	);

	if (!isConfigReady) return null;

	const budgetConfig = budgetConfigRows[0] ?? null;

	// Empty state — no budget configured
	if (!budgetConfig || budgetConfig.totalCentavos === 0n) {
		return (
			<div className="p-4 sm:p-6 ">
				<h1 className="text-xs font-medium tracking-widest text-base-content/60 uppercase mb-5">
					Budget
				</h1>
				<p className="text-sm text-base-content/60 mb-4">
					Set a monthly spending limit to track where your money goes.
				</p>
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
					Set budget
				</button>
				{showModal && <BudgetModal onClose={() => setShowModal(false)} />}
			</div>
		);
	}

	const othersColor = getTagColor(sortedTagStatuses.length);

	const totalPct =
		budgetConfig.totalCentavos > 0n
			? Math.round(Number((totalSpentCentavos * 100n) / budgetConfig.totalCentavos))
			: 0;

	const chartData = [
		{
			name: "Overall",
			declared: Number(budgetConfig.totalCentavos) / 100,
			actual: Number(totalSpentCentavos) / 100,
			fill: "color-mix(in oklab, var(--color-primary) 60%, transparent)",
			pct: totalPct,
		},
		...sortedTagStatuses.map((s, i) => ({
			name: s.tag.charAt(0).toUpperCase() + s.tag.slice(1).replace(/-/g, " "),
			declared: Number(s.allocatedCentavos) / 100,
			actual: Number(s.spentCentavos) / 100,
			fill: getTagColor(i),
			pct: s.percentUsed,
		})),
	];

	function getTagTransactions(tag: string | "__others__") {
		const now = new Date();
		return transactions
			.filter((txn) => {
				if (txn.type !== "expense") return false;
				const d = new Date(Number(txn.date.microsSinceUnixEpoch / 1000n));
				if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
				if (tag === "__others__") return !allocatedTags.has(txn.tag);
				return txn.tag === tag;
			})
			.sort((a, b) => {
				const da = Number(a.date.microsSinceUnixEpoch);
				const db = Number(b.date.microsSinceUnixEpoch);
				return db - da;
			});
	}

	return (
		<div className="p-4 sm:p-6 ">
			{/* Header */}
			<h1 className="text-xs font-medium tracking-widest text-base-content/60 uppercase mb-5">
				Budget
			</h1>

			{/* Overview + Chart — side by side on desktop, stacked on mobile */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-5 pb-4 border-b border-base-content/10">
				{/* Left: Hero + Stacked bar + Legend */}
				<div>
					{/* Hero */}
					<div className="flex items-start justify-between mb-3">
						<div>
							<div
								data-testid="hero-spent"
								className="text-3xl font-extrabold font-mono text-base-content leading-none"
							>
								{formatPesos(totalSpentCentavos)}
							</div>
							<button
								type="button"
								className="text-xs text-base-content/60 mt-1 hover:text-base-content/70 transition-colors flex items-center gap-1 cursor-pointer"
								onClick={() => setShowModal(true)}
							>
								of {formatPesos(budgetConfig.totalCentavos)} · {getMonthHeading()}
								<Pencil size={10} />
							</button>
						</div>
						<div
							data-testid="hero-pct"
							className={`text-3xl font-extrabold font-mono leading-none ${
								totalPct >= 100 ? "text-error" : "text-primary"
							}`}
						>
							{totalPct}%
						</div>
					</div>

					{/* Stacked bar */}
					<div className="h-4 rounded-full overflow-hidden flex bg-base-200 mb-2">
						{sortedTagStatuses.map((s) => {
							const widthPct =
								budgetConfig.totalCentavos > 0n
									? (Number(s.spentCentavos) / Number(budgetConfig.totalCentavos)) * 100
									: 0;
							return (
								<div
									key={s.tag}
									style={{
										width: `${widthPct.toFixed(2)}%`,
										background: colorByTag.get(s.tag) ?? getTagColor(0),
									}}
								/>
							);
						})}
						{otherSpentCentavos > 0n && (
							<div
								style={{
									width: `${(
										(Number(otherSpentCentavos) / Number(budgetConfig.totalCentavos)) * 100
									).toFixed(2)}%`,
									background: othersColor,
								}}
							/>
						)}
					</div>

					{/* Legend */}
					<div className="flex flex-wrap gap-x-3 gap-y-1">
						{sortedTagStatuses.map((s) => (
							<div key={s.tag} className="flex items-center gap-1.5">
								<div
									className="w-2 h-2 rounded-full flex-shrink-0"
									style={{ background: colorByTag.get(s.tag) ?? getTagColor(0) }}
								/>
								<span className="text-xs text-base-content/60 capitalize">
									{s.tag.replace(/-/g, " ")}
								</span>
							</div>
						))}
						{otherSpentCentavos > 0n && (
							<div className="flex items-center gap-1.5">
								<div
									className="w-2 h-2 rounded-full flex-shrink-0"
									style={{ background: othersColor }}
								/>
								<span className="text-xs text-base-content/60">Others</span>
							</div>
						)}
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full flex-shrink-0 bg-base-200" />
							<span className="text-xs text-base-content/60">Remaining</span>
						</div>
					</div>
				</div>

				{/* Right: Bar chart — Actual vs Declared */}
				<div data-testid="budget-bar-chart" className="">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-2">
						Budget vs Actual
					</h2>
					<ResponsiveContainer width="100%" height={220}>
						<BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
							<defs>
								<pattern
									id="budget-stripes"
									patternUnits="userSpaceOnUse"
									width="6"
									height="6"
									patternTransform="rotate(45)"
								>
									<rect
										width="6"
										height="6"
										fill="color-mix(in oklab, var(--color-error) 10%, transparent)"
									/>
									<line
										x1="0"
										y1="0"
										x2="0"
										y2="6"
										stroke="var(--color-error)"
										strokeWidth="2"
										strokeOpacity="0.4"
									/>
								</pattern>
							</defs>
							<CartesianGrid
								strokeDasharray="3 3"
								vertical={false}
								stroke="color-mix(in oklab, var(--color-base-content) 10%, transparent)"
							/>
							<XAxis
								dataKey="name"
								tick={{
									fontSize: 10,
									fill: "color-mix(in oklab, var(--color-base-content) 40%, transparent)",
								}}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tickFormatter={(v: number) => `P${v.toLocaleString()}`}
								tick={{
									fontSize: 10,
									fill: "color-mix(in oklab, var(--color-base-content) 40%, transparent)",
								}}
								axisLine={false}
								tickLine={false}
								width={70}
							/>
							<Tooltip
								formatter={(value, name) => {
									const numericValue = typeof value === "number" ? value : Number(value ?? 0);
									return [
										`P${numericValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
										String(name ?? ""),
									];
								}}
								contentStyle={{
									background: "var(--color-base-300)",
									border: "none",
									borderRadius: "var(--radius-box)",
									fontSize: "12px",
								}}
								itemStyle={{ color: "var(--color-base-content)" }}
							/>
							<Bar dataKey="declared" name="Budget" radius={[4, 4, 0, 0]} barSize={14}>
								{chartData.map((entry) => (
									<Cell key={`budget-${entry.name}`} fill="url(#budget-stripes)" />
								))}
							</Bar>
							<Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]} barSize={14}>
								{chartData.map((entry) => (
									<Cell key={`cell-${entry.name}`} fill={entry.fill} />
								))}
								<LabelList
									content={({ x, y, width: w, index }) => {
										if (typeof index !== "number") return null;
										const entry = chartData[index];
										if (!entry || entry.pct < 80) return null;
										const icon = entry.pct >= 100 ? "🚨" : "⚠️";
										const xPos = typeof x === "number" ? x : Number(x ?? 0);
										const yPos = typeof y === "number" ? y : Number(y ?? 0);
										const width = typeof w === "number" ? w : Number(w ?? 0);
										return (
											<text x={xPos + width / 2} y={yPos - 6} textAnchor="middle" fontSize={12}>
												{icon}
											</text>
										);
									}}
								/>
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			{/* Section label */}
			<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-2">
				Categories
			</h2>

			{/* Mini cards */}
			<div className="flex flex-col gap-1.5">
				{sortedTagStatuses.map((s, i) => {
					const tagColor = colorByTag.get(s.tag) ?? getTagColor(i);
					const isExpanded = expandedTag === s.tag;
					const tagTxns = isExpanded ? getTagTransactions(s.tag) : [];
					return (
						<div key={s.tag} className="" style={{ animationDelay: `${0.18 + i * 0.04}s` }}>
							<button
								type="button"
								data-testid={`tag-card-${s.tag}`}
								className={`rounded-xl px-3 py-2.5 flex items-center gap-3 w-full text-left cursor-pointer ${getCardClass(s.percentUsed)}`}
								onClick={() => setExpandedTag(isExpanded ? null : s.tag)}
							>
								<div
									className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
									style={{ background: tagColor }}
								/>
								<span className="text-sm font-semibold capitalize flex-1 text-base-content">
									{s.tag.replace(/-/g, " ")}
								</span>
								<div className="flex items-center gap-2">
									<div className="flex flex-col items-end gap-1">
										<span className="text-xs font-bold font-mono text-base-content/70">
											{s.percentUsed}% · {formatPesos(s.spentCentavos)}
										</span>
										<div className="w-16 h-1 bg-base-300 rounded-full overflow-hidden">
											<div
												className="h-full rounded-full"
												style={{
													width: `${Math.min(s.percentUsed, 100)}%`,
													background: getBarColor(s.percentUsed, tagColor),
												}}
											/>
										</div>
									</div>
									<ChevronDown
										size={14}
										className={`text-base-content/60 transition-transform ${isExpanded ? "rotate-180" : ""}`}
									/>
								</div>
							</button>
							{isExpanded && (
								<div className="ml-5 mr-3 mb-1 border-l-2 border-base-300 pl-3 py-1">
									{tagTxns.length === 0 ? (
										<p className="text-xs text-base-content/60 py-1">No transactions this month.</p>
									) : (
										tagTxns.map((txn) => {
											const d = new Date(Number(txn.date.microsSinceUnixEpoch / 1000n));
											const dateStr = d.toLocaleDateString("en-PH", {
												month: "short",
												day: "numeric",
											});
											const txnKey = txn.id
												? String(txn.id)
												: `${txn.date.microsSinceUnixEpoch.toString()}-${txn.tag}-${txn.description}`;
											return (
												<div key={txnKey} className="flex items-center justify-between py-1 gap-2">
													<div className="flex flex-col min-w-0">
														<span className="text-xs text-base-content/70 truncate">
															{txn.description || txn.tag}
														</span>
														<span className="text-[10px] text-base-content/60">{dateStr}</span>
													</div>
													<span className="text-xs font-mono text-base-content/60 flex-shrink-0">
														{formatPesos(txn.amountCentavos)}
													</span>
												</div>
											);
										})
									)}
								</div>
							)}
						</div>
					);
				})}

				{/* Others row */}
				{otherSpentCentavos > 0n &&
					(() => {
						const isExpanded = expandedTag === "__others__";
						const otherTxns = isExpanded ? getTagTransactions("__others__") : [];
						return (
							<div>
								<button
									type="button"
									data-testid="tag-card-others"
									className="rounded-xl px-3 py-2.5 flex items-center gap-3 bg-base-200/50 w-full text-left cursor-pointer"
									onClick={() => setExpandedTag(isExpanded ? null : "__others__")}
								>
									<div
										className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
										style={{ background: othersColor }}
									/>
									<span className="text-sm font-semibold flex-1 text-base-content">Others</span>
									<div className="flex items-center gap-2">
										<div className="flex flex-col items-end gap-1">
											<span className="text-xs font-bold font-mono text-base-content/70">
												{formatPesos(otherSpentCentavos)}
											</span>
											<span className="text-xs text-base-content/60 italic">no limit</span>
										</div>
										<ChevronDown
											size={14}
											className={`text-base-content/60 transition-transform ${isExpanded ? "rotate-180" : ""}`}
										/>
									</div>
								</button>
								{isExpanded && (
									<div className="ml-5 mr-3 mb-1 border-l-2 border-base-300 pl-3 py-1">
										{otherTxns.length === 0 ? (
											<p className="text-xs text-base-content/60 py-1">
												No transactions this month.
											</p>
										) : (
											otherTxns.map((txn) => {
												const d = new Date(Number(txn.date.microsSinceUnixEpoch / 1000n));
												const dateStr = d.toLocaleDateString("en-PH", {
													month: "short",
													day: "numeric",
												});
												const txnKey = txn.id
													? String(txn.id)
													: `${txn.date.microsSinceUnixEpoch.toString()}-${txn.tag}-${txn.description}`;
												return (
													<div
														key={txnKey}
														className="flex items-center justify-between py-1 gap-2"
													>
														<div className="flex flex-col min-w-0">
															<span className="text-xs text-base-content/70 truncate">
																{txn.description || txn.tag}
															</span>
															<span className="text-[10px] text-base-content/60">{dateStr}</span>
														</div>
														<span className="text-xs font-mono text-base-content/60 flex-shrink-0">
															{formatPesos(txn.amountCentavos)}
														</span>
													</div>
												);
											})
										)}
									</div>
								)}
							</div>
						);
					})()}
			</div>

			{showModal && <BudgetModal onClose={() => setShowModal(false)} />}
		</div>
	);
}
