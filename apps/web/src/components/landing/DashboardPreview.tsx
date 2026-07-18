type Stat = { label: string; value: string };
type Bar = { tag: string; pct: number };

const STATS: Stat[] = [
	{ label: "Total Assets", value: "₱248,310.55" },
	{ label: "Total Liabilities", value: "₱12,400.00" },
	{ label: "Net Worth", value: "₱235,910.55" },
];

const BARS: Bar[] = [
	{ tag: "foods", pct: 87 },
	{ tag: "bills", pct: 62 },
	{ tag: "transpo", pct: 41 },
];

// Illustrative 12-point monthly spend line inside a 300×80 viewBox.
const SPARK_POINTS =
	"0,52 27,44 54,58 81,40 108,50 135,30 162,46 189,22 216,38 243,18 270,34 300,26";

export function DashboardPreview() {
	return (
		<div className="card bg-base-100 border border-base-300 shadow-xl w-full" aria-hidden="true">
			<div className="card-body gap-4 p-4 sm:p-6">
				<div className="grid grid-cols-3 gap-2 text-center">
					{STATS.map((stat) => (
						<div key={stat.label} className="flex flex-col gap-1">
							<span className="text-[0.65rem] uppercase tracking-wide text-base-content/60">
								{stat.label}
							</span>
							<span className="font-semibold text-sm sm:text-base tabular-nums">{stat.value}</span>
						</div>
					))}
				</div>

				<div className="border-t border-base-300" />

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<span className="text-xs text-base-content/60">Monthly spend</span>
						<svg
							viewBox="0 0 300 80"
							role="img"
							aria-label="Monthly spending trend"
							className="w-full h-16 text-primary"
							preserveAspectRatio="none"
						>
							<polyline
								points={SPARK_POINTS}
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>

					<div className="flex flex-col gap-2">
						<span className="text-xs text-base-content/60">Budget · this month</span>
						{BARS.map((bar) => (
							<div key={bar.tag} className="flex items-center gap-2">
								<span className="w-16 shrink-0 text-xs text-base-content/70">{bar.tag}</span>
								<progress className="progress progress-primary flex-1" value={bar.pct} max={100} />
								<span className="w-9 shrink-0 text-right text-xs tabular-nums text-base-content/70">
									{bar.pct}%
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
