import { type ActualRow, computeActualsByTag } from "./budgetMath";

export type AllocationRow = {
	month: string;
	tagId: string;
	amountCentavos: number;
};

export type BudgetHistoryMonth = {
	monthISO: string;
	monthLabel: string;
	allocatedByTag: Map<string, number>;
	actualsByTag: Map<string, number>;
};

const SHORT_MONTH = [
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

export function shortMonthYearLabel(monthYYYYMM: string): string {
	const m = Number(monthYYYYMM.slice(5, 7));
	return `${SHORT_MONTH[m - 1] ?? "?"} ${monthYYYYMM.slice(0, 4)}`;
}

export function listMonths(currentMonthYYYYMM: string, count: number): string[] {
	const [yStr, mStr] = currentMonthYYYYMM.split("-");
	let y = Number(yStr);
	let m = Number(mStr);
	const months: string[] = [];
	for (let i = 0; i < count; i++) {
		months.unshift(`${y}-${String(m).padStart(2, "0")}`);
		m -= 1;
		if (m === 0) {
			m = 12;
			y -= 1;
		}
	}
	return months;
}

export function mergeBudgetHistory(
	months: readonly string[],
	allocs: readonly AllocationRow[],
	expenseRows: readonly ActualRow[],
): BudgetHistoryMonth[] {
	return months.map((m) => {
		const allocatedByTag = new Map<string, number>();
		for (const a of allocs) {
			if (a.month === m) allocatedByTag.set(a.tagId, a.amountCentavos);
		}
		return {
			monthISO: m,
			monthLabel: shortMonthYearLabel(m),
			allocatedByTag,
			actualsByTag: computeActualsByTag(expenseRows, m),
		};
	});
}
