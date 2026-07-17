import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	addDays,
	budgetRemaining,
	dateInTimezone,
	formatPhp,
	monthInTimezone,
	summarizeAccounts,
} from "./finance.js";
import type { AccountType, FinanceDataSource, TransactionType } from "./types.js";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");
const dateSchema = z.iso.date();
const accountTypeSchema = z.enum(["cash", "e-wallet", "savings", "credit", "time-deposit"]);
const transactionTypeSchema = z.enum(["expense", "income", "transfer"]);

const annotations = {
	readOnlyHint: true,
	openWorldHint: false,
	destructiveHint: false,
} as const;

function nextMonth(month: string) {
	const [yearText, monthText] = month.split("-");
	const year = Number(yearText);
	const monthIndex = Number(monthText) - 1;
	const next = new Date(Date.UTC(year, monthIndex + 1, 1));
	return next.toISOString().slice(0, 7);
}

function toolResult(structuredContent: Record<string, unknown>, summary: string) {
	return {
		structuredContent,
		content: [{ type: "text" as const, text: summary }],
	};
}

function accountOutput(account: Awaited<ReturnType<FinanceDataSource["listAccounts"]>>[number]) {
	return {
		name: account.name,
		type: account.type,
		groupName: account.groupName,
		balanceCentavos: account.balanceCentavos,
		balance: formatPhp(account.balanceCentavos),
		isArchived: account.isArchived,
		creditLimitCentavos: account.creditLimitCentavos,
		creditLimit:
			account.creditLimitCentavos === null ? null : formatPhp(account.creditLimitCentavos),
		maturityDate: account.maturityDate,
		isMatured: account.isMatured,
	};
}

export function createKwartrackServer(dataSource: FinanceDataSource) {
	const server = new McpServer(
		{ name: "kwartrack", version: "0.1.0" },
		{
			instructions:
				"Kwartrack contains the signed-in user's private PHP-denominated personal finance data. All tools are read-only. Use exact date ranges when the user provides them, do not imply that account balances are historical, and never expose internal IDs unless needed to disambiguate results.",
		},
	);

	server.registerTool(
		"get_financial_summary",
		{
			title: "Get financial summary",
			description:
				"Get current account balances, assets, liabilities, net worth, and income, expenses, and budget progress for one calendar month. Account balances are always current, while cash flow and budget values use the selected month.",
			inputSchema: { month: monthSchema.optional() },
			outputSchema: {
				month: monthSchema,
				accountBalancesAsOf: dateSchema,
				assetsCentavos: z.number().int(),
				assets: z.string(),
				liabilitiesCentavos: z.number().int(),
				liabilities: z.string(),
				netWorthCentavos: z.number().int(),
				netWorth: z.string(),
				incomeCentavos: z.number().int(),
				income: z.string(),
				expensesCentavos: z.number().int(),
				expenses: z.string(),
				cashFlowNetCentavos: z.number().int(),
				cashFlowNet: z.string(),
				budgetCentavos: z.number().int(),
				budget: z.string(),
				budgetRemainingCentavos: z.number().int(),
				budgetRemaining: z.string(),
			},
			annotations,
		},
		async ({ month }) => {
			const profile = await dataSource.getProfile();
			const selectedMonth = month ?? monthInTimezone(new Date(), profile.timezone);
			const [accounts, cashFlow, budget] = await Promise.all([
				dataSource.listAccounts({ includeArchived: false }),
				dataSource.getMonthCashFlow(`${selectedMonth}-01`, `${nextMonth(selectedMonth)}-01`),
				dataSource.getBudgetStatus(selectedMonth),
			]);
			const balances = summarizeAccounts(accounts);
			const remaining = budgetRemaining(budget);
			const structuredContent = {
				month: selectedMonth,
				accountBalancesAsOf: dateInTimezone(new Date(), profile.timezone),
				assetsCentavos: balances.assetsCentavos,
				assets: formatPhp(balances.assetsCentavos),
				liabilitiesCentavos: balances.liabilitiesCentavos,
				liabilities: formatPhp(balances.liabilitiesCentavos),
				netWorthCentavos: balances.netWorthCentavos,
				netWorth: formatPhp(balances.netWorthCentavos),
				incomeCentavos: cashFlow.incomeCentavos,
				income: formatPhp(cashFlow.incomeCentavos),
				expensesCentavos: cashFlow.expenseCentavos,
				expenses: formatPhp(cashFlow.expenseCentavos),
				cashFlowNetCentavos: cashFlow.netCentavos,
				cashFlowNet: formatPhp(cashFlow.netCentavos),
				budgetCentavos: budget.overallBudgetCentavos,
				budget: formatPhp(budget.overallBudgetCentavos),
				budgetRemainingCentavos: remaining,
				budgetRemaining: formatPhp(remaining),
			};
			return toolResult(
				structuredContent,
				`Current net worth is ${structuredContent.netWorth}. Expenses for ${selectedMonth} are ${structuredContent.expenses}.`,
			);
		},
	);

	server.registerTool(
		"list_accounts",
		{
			title: "List accounts",
			description:
				"List the signed-in user's Kwartrack accounts and current balances. Optionally filter by account type or include archived accounts.",
			inputSchema: {
				type: accountTypeSchema.optional(),
				includeArchived: z.boolean().default(false),
			},
			outputSchema: {
				accounts: z.array(
					z.object({
						name: z.string(),
						type: accountTypeSchema,
						groupName: z.string().nullable(),
						balanceCentavos: z.number().int(),
						balance: z.string(),
						isArchived: z.boolean(),
						creditLimitCentavos: z.number().int().nullable(),
						creditLimit: z.string().nullable(),
						maturityDate: z.string().nullable(),
						isMatured: z.boolean(),
					}),
				),
				count: z.number().int(),
			},
			annotations,
		},
		async ({ type, includeArchived }) => {
			const options: { includeArchived: boolean; type?: AccountType } = { includeArchived };
			if (type) options.type = type;
			const accounts = (await dataSource.listAccounts(options)).map(accountOutput);
			return toolResult(
				{ accounts, count: accounts.length },
				accounts.length === 0
					? "No matching Kwartrack accounts were found."
					: `Found ${accounts.length} Kwartrack account${accounts.length === 1 ? "" : "s"}.`,
			);
		},
	);

	server.registerTool(
		"search_transactions",
		{
			title: "Search transactions",
			description:
				"Search Kwartrack transactions by date range, type, exact account name, exact tag name, or text. Returns at most 100 matching transactions and the total match count.",
			inputSchema: {
				dateFrom: dateSchema.optional(),
				dateTo: dateSchema.optional(),
				type: transactionTypeSchema.optional(),
				tagName: z.string().trim().min(1).max(50).optional(),
				accountName: z.string().trim().min(1).max(50).optional(),
				query: z.string().trim().max(100).optional(),
				sort: z.enum(["newest", "oldest", "largest", "smallest"]).default("newest"),
				limit: z.number().int().min(1).max(100).default(25),
			},
			outputSchema: {
				transactions: z.array(
					z.object({
						type: transactionTypeSchema,
						amountCentavos: z.number().int(),
						amount: z.string(),
						feeCentavos: z.number().int().nullable(),
						fee: z.string().nullable(),
						description: z.string().nullable(),
						date: dateSchema,
						tagName: z.string().nullable(),
						fromAccountName: z.string().nullable(),
						toAccountName: z.string().nullable(),
						isRecurring: z.boolean(),
					}),
				),
				returnedCount: z.number().int(),
				totalCount: z.number().int(),
			},
			annotations,
		},
		async (input) => {
			const filters: Parameters<FinanceDataSource["searchTransactions"]>[0] = {
				limit: input.limit,
			};
			if (input.dateFrom) filters.dateFrom = input.dateFrom;
			if (input.dateTo) filters.dateTo = input.dateTo;
			if (input.type) filters.type = input.type as TransactionType;
			if (input.tagName) filters.tagName = input.tagName;
			if (input.accountName) filters.accountName = input.accountName;
			if (input.query) filters.query = input.query;
			filters.sort = input.sort;
			const results = await dataSource.searchTransactions(filters);
			const transactions = results.map(({ id: _id, totalCount: _totalCount, ...transaction }) => ({
				...transaction,
				amount: formatPhp(transaction.amountCentavos),
				fee: transaction.feeCentavos === null ? null : formatPhp(transaction.feeCentavos),
			}));
			const totalCount = results[0]?.totalCount ?? 0;
			return toolResult(
				{ transactions, returnedCount: results.length, totalCount },
				`Returned ${results.length} of ${totalCount} matching transactions.`,
			);
		},
	);

	server.registerTool(
		"get_budget_status",
		{
			title: "Get budget status",
			description:
				"Get Kwartrack's overall and per-tag budget versus actual expense spending for one calendar month.",
			inputSchema: { month: monthSchema.optional() },
			outputSchema: {
				month: monthSchema,
				overallBudgetCentavos: z.number().int(),
				overallBudget: z.string(),
				overallActualCentavos: z.number().int(),
				overallActual: z.string(),
				remainingCentavos: z.number().int(),
				remaining: z.string(),
				isOverBudget: z.boolean(),
				allocations: z.array(
					z.object({
						tagName: z.string(),
						budgetCentavos: z.number().int(),
						budget: z.string(),
						actualCentavos: z.number().int(),
						actual: z.string(),
						remainingCentavos: z.number().int(),
						remaining: z.string(),
						isOverBudget: z.boolean(),
					}),
				),
				unbudgetedCentavos: z.number().int(),
				unbudgeted: z.string(),
			},
			annotations,
		},
		async ({ month }) => {
			const profile = await dataSource.getProfile();
			const selectedMonth = month ?? monthInTimezone(new Date(), profile.timezone);
			const status = await dataSource.getBudgetStatus(selectedMonth);
			const remaining = budgetRemaining(status);
			const allocations = status.allocations.map((allocation) => {
				const allocationRemaining = allocation.budgetCentavos - allocation.actualCentavos;
				return {
					...allocation,
					budget: formatPhp(allocation.budgetCentavos),
					actual: formatPhp(allocation.actualCentavos),
					remainingCentavos: allocationRemaining,
					remaining: formatPhp(allocationRemaining),
					isOverBudget: allocationRemaining < 0,
				};
			});
			const structuredContent = {
				month: selectedMonth,
				overallBudgetCentavos: status.overallBudgetCentavos,
				overallBudget: formatPhp(status.overallBudgetCentavos),
				overallActualCentavos: status.overallActualCentavos,
				overallActual: formatPhp(status.overallActualCentavos),
				remainingCentavos: remaining,
				remaining: formatPhp(remaining),
				isOverBudget: remaining < 0,
				allocations,
				unbudgetedCentavos: status.unbudgetedCentavos,
				unbudgeted: formatPhp(status.unbudgetedCentavos),
			};
			return toolResult(
				structuredContent,
				remaining < 0
					? `The ${selectedMonth} budget is over by ${formatPhp(-remaining)}.`
					: `The ${selectedMonth} budget has ${formatPhp(remaining)} remaining.`,
			);
		},
	);

	server.registerTool(
		"list_upcoming",
		{
			title: "List upcoming financial items",
			description:
				"List active recurring transactions due within a future window and currently unsettled debts, ordered by urgency.",
			inputSchema: {
				days: z.number().int().min(1).max(90).default(30),
				limit: z.number().int().min(1).max(100).default(25),
			},
			outputSchema: {
				dateFrom: dateSchema,
				dateTo: dateSchema,
				items: z.array(
					z.object({
						kind: z.enum(["recurring", "debt"]),
						name: z.string(),
						date: dateSchema,
						amountCentavos: z.number().int(),
						amount: z.string(),
						direction: z.string(),
						accountName: z.string().nullable(),
					}),
				),
				count: z.number().int(),
			},
			annotations,
		},
		async ({ days, limit }) => {
			const profile = await dataSource.getProfile();
			const now = new Date();
			const dateFrom = dateInTimezone(now, profile.timezone);
			const dateTo = dateInTimezone(addDays(now, days), profile.timezone);
			const items = (
				await dataSource.listUpcoming({
					from: dateFrom,
					to: dateTo,
					timezone: profile.timezone,
					limit,
				})
			).map(({ id: _id, ...item }) => ({ ...item, amount: formatPhp(item.amountCentavos) }));
			return toolResult(
				{ dateFrom, dateTo, items, count: items.length },
				items.length === 0
					? `Nothing is due through ${dateTo}.`
					: `Found ${items.length} upcoming or unsettled item${items.length === 1 ? "" : "s"}.`,
			);
		},
	);

	return server;
}
