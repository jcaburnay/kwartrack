import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKwartrackServer } from "./tools.js";
import type {
	Account,
	AccountType,
	BudgetStatus,
	FinanceDataSource,
	TransactionResult,
	TransactionSearch,
	UpcomingItem,
} from "./types.js";

class FakeFinanceDataSource implements FinanceDataSource {
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

	async getBudgetStatus(month: string): Promise<BudgetStatus> {
		return {
			month,
			overallBudgetCentavos: 100_000,
			overallActualCentavos: 75_000,
			allocations: [{ tagName: "grocery", budgetCentavos: 30_000, actualCentavos: 12_345 }],
			unbudgetedCentavos: 5_000,
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

	beforeEach(async () => {
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		server = createKwartrackServer(new FakeFinanceDataSource());
		client = new Client({ name: "kwartrack-test", version: "1.0.0" });
		await server.connect(serverTransport);
		await client.connect(clientTransport);
	});

	afterEach(async () => {
		await client.close();
		await server.close();
	});

	it("publishes only explicitly read-only tools", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual([
			"get_financial_summary",
			"list_accounts",
			"search_transactions",
			"get_budget_status",
			"list_upcoming",
		]);
		for (const tool of tools) {
			expect(tool.annotations).toMatchObject({
				readOnlyHint: true,
				openWorldHint: false,
				destructiveHint: false,
			});
		}
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
