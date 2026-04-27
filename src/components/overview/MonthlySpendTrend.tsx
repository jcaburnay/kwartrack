import { useNavigate } from "react-router";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCentavos } from "../../utils/currency";
import type { SpendTrendPoint } from "../../utils/overviewAggregation";

type Props = {
	data: readonly SpendTrendPoint[];
	isLoading: boolean;
};

function monthBoundsFromISO(monthISO: string): { startISO: string; endISO: string } {
	const [yStr, mStr] = monthISO.split("-");
	const y = Number(yStr);
	const m = Number(mStr);
	// `Date.UTC(y, m, 0)` resolves to the last day of month `m` (1-indexed) —
	// JS Date months are 0-indexed, so passing `m` lands on the next month and
	// day 0 backs up to the last day of the previous (target) month.
	const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return {
		startISO: `${monthISO}-01`,
		endISO: `${monthISO}-${String(lastDay).padStart(2, "0")}`,
	};
}

function shortMonthLabel(monthISO: string): string {
	// "2025-04" → "Apr"
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

export function MonthlySpendTrend({ data, isLoading }: Props) {
	const navigate = useNavigate();

	function handleChartClick(state: unknown) {
		const s = state as { activePayload?: Array<{ payload: SpendTrendPoint }> } | null;
		const point = s?.activePayload?.[0]?.payload;
		if (!point) return;
		const { startISO, endISO } = monthBoundsFromISO(point.monthISO);
		navigate(`/accounts?date_start=${startISO}&date_end=${endISO}`);
	}

	return (
		<section className="card bg-base-100 shadow-sm">
			<div className="card-body gap-2">
				<h3 className="card-title text-lg">Monthly Spend (last 12 months)</h3>
				<div className="h-64">
					{isLoading ? (
						<div className="skeleton h-full w-full" />
					) : (
						<ResponsiveContainer width="100%" height="100%">
							<LineChart
								data={data.map((p) => ({ ...p, label: shortMonthLabel(p.monthISO) }))}
								onClick={handleChartClick}
								style={{ cursor: "pointer" }}
							>
								<CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
								<XAxis dataKey="label" tick={{ fontSize: 12 }} />
								<YAxis
									tick={{ fontSize: 12 }}
									tickFormatter={(v: number) => formatCentavos(v)}
									width={80}
								/>
								<Tooltip
									formatter={(value: number) => [formatCentavos(value), "Spend"]}
									labelFormatter={(_label, payload) => {
										const point = payload?.[0]?.payload as SpendTrendPoint | undefined;
										return point?.monthLabel ?? "";
									}}
								/>
								<Line
									type="monotone"
									dataKey="totalCentavos"
									className="stroke-primary"
									strokeWidth={2}
									dot={{ r: 3 }}
									activeDot={{ r: 5 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					)}
				</div>
			</div>
		</section>
	);
}
