import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKwartrackServer } from "./tools.js";
import type {
	Account,
	AccountType,
	BudgetStatus,
	CreateExpenseInput,
	CreateExpenseResult,
	FinanceDataSource,
	PeriodBudgetStatus,
	TransactionResult,
	TransactionSearch,
	UpcomingItem,
} from "./types.js";

class FakeFinanceDataSource implements FinanceDataSource {
	createdExpenses: CreateExpenseInput[] = [];

	accounts: Account[] = [
		{
			id: "cash-1",
			name: "Wallet",
			type: "cash",
			groupName: null,
			balanceCentavos: 150_000,
			isArchived: false,
			creditLimitCentavos: null,
			maturityDate: null,
			isMatured: false,
		},
		{
			id: "card-1",
			name: "Visa",
			type: "credit",
			groupName: "Bank",
			balanceCentavos: 25_000,
			isArchived: false,
			creditLimitCentavos: 100_000,
			maturityDate: null,
			isMatured: false,
		},
	];

	async getProfile() {
		return { displayName: "Test User", timezone: "Asia/Manila" };
	}

	async getMonthCashFlow() {
		return { incomeCentavos: 200_000, expenseCentavos: 75_000, netCentavos: 125_000 };
	}

	async listAccounts(options: { includeArchived: boolean; type?: AccountType }) {
		return this.accounts.filter(
			(account) =>
				(options.includeArchived || !account.isArchived) &&
				(!options.type || account.type === options.type),
		);
	}

	async searchTransactions(_filters: TransactionSearch): Promise<TransactionResult[]> {
		return [
			{
				id: "tx-1",
				type: "expense",
				amountCentavos: 12_345,
				feeCentavos: null,
				description: "Groceries",
				date: "2026-07-05",
				tagName: "grocery",
				fromAccountName: "Wallet",
				toAccountName: null,
				isRecurring: false,
				totalCount: 1,
			},
		];
	}

	async createExpense(input: CreateExpenseInput): Promise<CreateExpenseResult> {
		this.createdExpenses.push(input);
		return {
			wasDuplicate: false,
			amountCentavos: input.amountCentavos,
			date: input.date,
			description: input.description ?? null,
			accountName: input.accountName,
			tagName: input.tagName,
		};
	}

	async getBudgetStatus(month: string): Promise<BudgetStatus> {
		return {
			month,
			overallBudgetCentavos: 100_000,
			overallActualCentavos: 75_000,
			allocations: [{ tagName: "grocery", budgetCentavos: 30_000, actualCentavos: 12_345 }],
			unbudgetedCentavos: 5_000,
		};
	}

	periodRequests: Array<{ periodId?: string; asOf?: string }> = [];
	gap = false;
	async getBudgetPeriodStatus(selector: {
		periodId?: string;
		asOf?: string;
	}): Promise<PeriodBudgetStatus> {
		this.periodRequests.push(selector);
		const { month: _month, ...status } = await this.getBudgetStatus("2026-11");
		return this.gap
			? {
					period: null,
					overallBudgetCentavos: 0,
					overallActualCentavos: 0,
					allocations: [],
					unbudgetedCentavos: 0,
				}
			: {
					...status,
					period: {
						id: "11111111-1111-4111-8111-111111111111",
						startDate: "2026-11-15",
						endDate: "2026-12-15",
					},
				};
	}

	async listUpcoming(): Promise<UpcomingItem[]> {
		return [
			{
				id: "rec-1",
				kind: "recurring",
				name: "Internet",
				date: "2026-07-20",
				amountCentavos: 20_000,
				direction: "expense",
				accountName: "Wallet",
			},
		];
	}
}

describe("Kwartrack MCP tools", () => {
	let client: Client;
	let server: ReturnType<typeof createKwartrackServer>;
	let dataSource: FakeFinanceDataSource;

	beforeEach(async () => {
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		dataSource = new FakeFinanceDataSource();
		server = createKwartrackServer(dataSource);
		client = new Client({ name: "kwartrack-test", version: "1.0.0" });
		await server.connect(serverTransport);
		await client.connect(clientTransport);
	});

	it("defaults to today's date in the profile timezone across UTC midnight", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-11-15T00:30:00Z"));
		vi.spyOn(dataSource, "getProfile").mockResolvedValue({
			displayName: "Test User",
			timezone: "America/Los_Angeles",
		});
		try {
			const response = await client.callTool({ name: "get_budget_status", arguments: {} });
			expect(response.isError).not.toBe(true);
			expect(dataSource.periodRequests).toEqual([{ asOf: "2026-11-14" }]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("selects the inclusive budget period for an explicit as-of date", async () => {
		const response = await client.callTool({
			name: "get_budget_status",
			arguments: { asOf: "2026-12-15" },
		});
		expect(response.isError).not.toBe(true);
		expect(response.structuredContent).toMatchObject({
			basis: "period",
			month: null,
			period: { startDate: "2026-11-15", endDate: "2026-12-15" },
		});
		expect(dataSource.periodRequests).toEqual([{ asOf: "2026-12-15" }]);
	});
	it("reports no active budget in gaps without an over-budget warning", async () => {
		dataSource.gap = true;
		const response = await client.callTool({
			name: "get_budget_status",
			arguments: { asOf: "2026-12-20" },
		});
		expect(response.structuredContent).toMatchObject({ period: null, isOverBudget: false });
		expect(JSON.stringify(response.content)).toContain("No active budget");
	});
	it("rejects conflicting monthly and period selectors", async () => {
		const response = await client.callTool({
			name: "get_budget_status",
			arguments: { month: "2026-11", asOf: "2026-11-15" },
		});
		expect(response.isError).toBe(true);
	});

	afterEach(async () => {
		await client.close();
		await server.close();
	});

	it("publishes five read tools and one private write tool", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual([
			"get_financial_summary",
			"list_accounts",
			"search_transactions",
			"create_transaction",
			"get_budget_status",
			"list_upcoming",
		]);
		for (const tool of tools.filter((candidate) => candidate.name !== "create_transaction")) {
			expect(tool.annotations).toMatchObject({
				readOnlyHint: true,
				openWorldHint: false,
				destructiveHint: false,
			});
		}
		expect(tools.find((tool) => tool.name === "create_transaction")?.annotations).toMatchObject({
			readOnlyHint: false,
			openWorldHint: false,
			destructiveHint: false,
		});
	});

	it("returns a finance summary with current balances and monthly values", async () => {
		const result = await client.callTool({
			name: "get_financial_summary",
			arguments: { month: "2026-07" },
		});
		expect(result.structuredContent).toMatchObject({
			month: "2026-07",
			assetsCentavos: 150_000,
			liabilitiesCentavos: 25_000,
			netWorthCentavos: 125_000,
			incomeCentavos: 200_000,
			expensesCentavos: 75_000,
			budgetRemainingCentavos: 25_000,
		});
	});

	it("formats transaction amounts while preserving exact centavos", async () => {
		const result = await client.callTool({
			name: "search_transactions",
			arguments: { dateFrom: "2026-07-01", dateTo: "2026-07-31" },
		});
		expect(result.structuredContent).toMatchObject({
			returnedCount: 1,
			totalCount: 1,
			transactions: [
				{
					amountCentavos: 12_345,
					amount: "₱123.45",
					tagName: "grocery",
				},
			],
		});
	});

	it("records a confirmed receipt expense without exposing internal IDs", async () => {
		const input = {
			idempotencyKey: "3d813cbb-77bb-4e6d-a266-a2e501a38c41",
			amountCentavos: 129_900,
			date: "2026-07-29",
			accountName: "Visa",
			tagName: "grocery",
			description: "SM Supermarket",
		};
		const result = await client.callTool({
			name: "create_transaction",
			arguments: input,
		});
		expect(result.isError).not.toBe(true);
		expect(result.structuredContent).toEqual({
			type: "expense",
			wasDuplicate: false,
			amountCentavos: 129_900,
			amount: "₱1,299.00",
			date: "2026-07-29",
			accountName: "Visa",
			tagName: "grocery",
			description: "SM Supermarket",
		});
		expect(dataSource.createdExpenses).toEqual([input]);
	});

	it("reports per-tag and overall budget status", async () => {
		const result = await client.callTool({
			name: "get_budget_status",
			arguments: { month: "2026-07" },
		});
		expect(result.structuredContent).toMatchObject({
			isOverBudget: false,
			remainingCentavos: 25_000,
			allocations: [
				{
					tagName: "grocery",
					remainingCentavos: 17_655,
					isOverBudget: false,
				},
			],
		});
	});
});
