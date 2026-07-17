export type AccountType = "cash" | "e-wallet" | "savings" | "credit" | "time-deposit";
export type TransactionType = "expense" | "income" | "transfer";

export type Profile = {
	displayName: string;
	timezone: string;
};

export type Account = {
	id: string;
	name: string;
	type: AccountType;
	groupName: string | null;
	balanceCentavos: number;
	isArchived: boolean;
	creditLimitCentavos: number | null;
	maturityDate: string | null;
	isMatured: boolean;
};

export type TransactionSearch = {
	dateFrom?: string;
	dateTo?: string;
	type?: TransactionType;
	tagName?: string;
	accountName?: string;
	query?: string;
	sort?: "newest" | "oldest" | "largest" | "smallest";
	limit: number;
};

export type TransactionResult = {
	id: string;
	type: TransactionType;
	amountCentavos: number;
	feeCentavos: number | null;
	description: string | null;
	date: string;
	tagName: string | null;
	fromAccountName: string | null;
	toAccountName: string | null;
	isRecurring: boolean;
	totalCount: number;
};

export type BudgetStatus = {
	month: string;
	overallBudgetCentavos: number;
	overallActualCentavos: number;
	allocations: Array<{
		tagName: string;
		budgetCentavos: number;
		actualCentavos: number;
	}>;
	unbudgetedCentavos: number;
};

export type UpcomingItem = {
	id: string;
	kind: "recurring" | "debt";
	name: string;
	date: string;
	amountCentavos: number;
	direction: string;
	accountName: string | null;
};

export interface FinanceDataSource {
	getProfile(): Promise<Profile>;
	getMonthCashFlow(
		dateFrom: string,
		dateToExclusive: string,
	): Promise<{ incomeCentavos: number; expenseCentavos: number; netCentavos: number }>;
	listAccounts(options: { includeArchived: boolean; type?: AccountType }): Promise<Account[]>;
	searchTransactions(filters: TransactionSearch): Promise<TransactionResult[]>;
	getBudgetStatus(month: string): Promise<BudgetStatus>;
	listUpcoming(options: {
		from: string;
		to: string;
		timezone: string;
		limit: number;
	}): Promise<UpcomingItem[]>;
}
