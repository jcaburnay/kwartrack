import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCentavos, formatCentavosCompact } from "../../utils/currency";
import type { AccountBalanceRow } from "../../utils/netWorthAggregation";

type Props = {
	rows: readonly AccountBalanceRow[];
	isLoading: boolean;
};

function truncate(name: string, max = 14): string {
	if (name.length <= max) return name;
	return `${name.slice(0, max - 1)}…`;
}

export function AccountBalancesBar({ rows, isLoading }: Props) {
	if (isLoading) return <div className="skeleton h-full w-full" />;
	if (rows.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-sm text-base-content/60">
				No accounts yet.
			</div>
		);
	}

	const data = rows.map((r) => ({ ...r, displayName: truncate(r.name) }));
	// Reserve ~28px per row + ~24px for the X axis. Caps so the chart can
	// scroll inside a fixed-height parent.
	const chartHeight = Math.max(160, data.length * 28 + 24);

	return (
		<div className="h-full min-h-0 overflow-y-auto">
			<ResponsiveContainer width="100%" height={chartHeight}>
				<BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
					<CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-base-300" />
					<XAxis
						type="number"
						tick={{ fontSize: 11 }}
						tickFormatter={(v: number) => formatCentavosCompact(v)}
					/>
					<YAxis type="category" dataKey="displayName" tick={{ fontSize: 11 }} width={96} />
					<Tooltip
						formatter={(value: number) => [formatCentavos(value), "Balance"]}
						labelFormatter={(label: string, payload) => {
							const row = payload?.[0]?.payload as AccountBalanceRow | undefined;
							return row?.name ?? label;
						}}
					/>
					<Bar dataKey="centavos" radius={[0, 3, 3, 0]}>
						{data.map((row) => (
							<Cell
								key={row.accountId}
								style={{
									fill: row.isLiability ? "var(--color-warning)" : "var(--color-primary)",
									fillOpacity: row.isLiability ? 0.6 : 0.7,
								}}
							/>
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
