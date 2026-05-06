import { useMemo } from "react";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCentavos, formatCentavosCompact } from "../../utils/currency";
import type { CashFlowPoint } from "../../utils/netWorthAggregation";

type Props = {
	data: readonly CashFlowPoint[];
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

export function CashFlowTrend({ data, isLoading }: Props) {
	// Render expense as negative so income/expense flank the zero line.
	const enriched = useMemo(
		() =>
			data.map((p) => ({
				...p,
				expenseSigned: -p.expenseCentavos,
				label: shortMonthLabel(p.monthISO),
			})),
		[data],
	);
	if (isLoading) return <div className="skeleton h-full w-full" />;
	const showDots = data.length <= 6;

	return (
		<ResponsiveContainer width="100%" height="100%" minHeight={160}>
			<ComposedChart data={enriched} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
				<CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
				<XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
				<YAxis
					tick={{ fontSize: 11 }}
					tickFormatter={(v: number) => formatCentavosCompact(v)}
					width={44}
				/>
				<Tooltip
					formatter={(value: number, name: string) => {
						const display = name === "Expense" ? Math.abs(value) : value;
						return [formatCentavos(display), name];
					}}
					labelFormatter={(_label, payload) => {
						const point = payload?.[0]?.payload as CashFlowPoint | undefined;
						return point?.monthLabel ?? "";
					}}
				/>
				<ReferenceLine y={0} className="stroke-base-content/30" />
				<Bar dataKey="incomeCentavos" name="Income" className="fill-success/40" />
				<Bar dataKey="expenseSigned" name="Expense" className="fill-error/40" />
				<Line
					type="monotone"
					dataKey="netCentavos"
					name="Net"
					className="stroke-primary"
					strokeWidth={2}
					dot={showDots ? { r: 3 } : false}
					activeDot={{ r: 5 }}
				/>
			</ComposedChart>
		</ResponsiveContainer>
	);
}
