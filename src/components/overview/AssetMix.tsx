import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AccountType } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { AssetMixSlice } from "../../utils/netWorthAggregation";

type Props = {
	assets: readonly AssetMixSlice[];
	liabilities: readonly AssetMixSlice[];
	isLoading: boolean;
};

// Map each asset type to a DaisyUI semantic color variable. Stable across
// renders so a slice's color doesn't shift when other types come and go.
// Rendered via inline `style.fill = var(--color-X)` because Tailwind v4 +
// DaisyUI v5 don't reliably synthesize `fill-primary` etc. for SVG elements.
const TYPE_FILL: Record<AccountType, string> = {
	cash: "var(--color-primary)",
	"e-wallet": "var(--color-secondary)",
	savings: "var(--color-accent)",
	"time-deposit": "var(--color-info)",
	credit: "var(--color-warning)",
};

export function AssetMix({ assets, liabilities, isLoading }: Props) {
	if (isLoading) return <div className="skeleton h-full w-full" />;
	const totalAssets = assets.reduce((acc, s) => acc + s.centavos, 0);
	const totalLiabilities = liabilities.reduce((acc, s) => acc + s.centavos, 0);

	if (assets.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-sm text-base-content/60">
				No asset accounts yet.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2 h-full min-h-0">
			<div className="flex-1 min-h-0">
				<ResponsiveContainer width="100%" height="100%" minHeight={120}>
					<PieChart>
						<Pie
							data={[...assets]}
							dataKey="centavos"
							nameKey="label"
							cx="50%"
							cy="50%"
							innerRadius="55%"
							outerRadius="85%"
							paddingAngle={1}
							strokeWidth={0}
							isAnimationActive={false}
						>
							{assets.map((slice) => (
								<Cell key={slice.type} style={{ fill: TYPE_FILL[slice.type] }} />
							))}
						</Pie>
						<Tooltip formatter={(value: number, name: string) => [formatCentavos(value), name]} />
					</PieChart>
				</ResponsiveContainer>
			</div>

			<ul className="flex flex-col gap-1 text-xs">
				{assets.map((slice) => {
					const pct = totalAssets === 0 ? 0 : Math.round((slice.centavos / totalAssets) * 100);
					return (
						<li key={slice.type} className="flex items-center gap-2 min-w-0">
							<span
								aria-hidden="true"
								className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
								style={{ backgroundColor: TYPE_FILL[slice.type] }}
							/>
							<span className="truncate text-base-content/70">{slice.label}</span>
							<span className="ml-auto tabular-nums text-base-content/60 flex-shrink-0">
								{pct}%
							</span>
						</li>
					);
				})}
			</ul>

			{totalLiabilities > 0 && (
				<p className="text-xs text-base-content/60">
					Liabilities:{" "}
					<span className="tabular-nums text-base-content/80">
						{formatCentavos(totalLiabilities)}
					</span>{" "}
					({liabilities.length} credit account{liabilities.length === 1 ? "" : "s"})
				</p>
			)}
		</div>
	);
}
