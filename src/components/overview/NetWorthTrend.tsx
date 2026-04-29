import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCentavos, formatCentavosCompact } from "../../utils/currency";
import type { NetWorthPoint } from "../../utils/netWorthAggregation";

type Props = {
	data: readonly NetWorthPoint[];
	isLoading: boolean;
};

function shortMonthLabel(monthISO: string): string {
	const monthIdx = Number.parseInt(monthISO.slice(5, 7), 10) - 1;
	const NAMES = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return NAMES[monthIdx] ?? monthISO.slice(5, 7);
}

export function NetWorthTrend({ data, isLoading }: Props) {
	if (isLoading) return <div className="skeleton h-full w-full" />;
	const enriched = data.map((p) => ({ ...p, label: shortMonthLabel(p.monthISO) }));

	return (
		<ResponsiveContainer width="100%" height="100%" minHeight={160}>
			<LineChart data={enriched} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
				<CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
				<XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
				<YAxis
					tick={{ fontSize: 11 }}
					tickFormatter={(v: number) => formatCentavosCompact(v)}
					width={56}
				/>
				<Tooltip
					formatter={(value: number) => [formatCentavos(value), "Net Worth"]}
					labelFormatter={(_label, payload) => {
						const point = payload?.[0]?.payload as NetWorthPoint | undefined;
						return point?.monthLabel ?? "";
					}}
				/>
				<Line
					type="monotone"
					dataKey="netWorthCentavos"
					className="stroke-primary"
					strokeWidth={2}
					dot={{ r: 3 }}
					activeDot={{ r: 5 }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
