import { createClient } from "@supabase/supabase-js";
import type {
	Account,
	AccountType,
	BudgetStatus,
	FinanceDataSource,
	Profile,
	TransactionResult,
	TransactionSearch,
	UpcomingItem,
} from "./types.js";

type QueryError = { message: string } | null;

type AccountRow = {
	id: string;
	name: string;
	type: AccountType;
	balance_centavos: number | string;
	is_archived: boolean;
	credit_limit_centavos: number | string | null;
	maturity_date: string | null;
	is_matured: boolean;
	account_group: { name: string } | Array<{ name: string }> | null;
};

type TagRow = { id: string; name: string };

type TransactionRow = {
	id: string;
	type: "expense" | "income" | "transfer";
	amount_centavos: number | string;
	fee_centavos: number | string | null;
	description: string | null;
	date: string;
	tag_id: string | null;
	from_account_id: string | null;
	to_account_id: string | null;
	recurring_id: string | null;
	total_count: number | string;
};

type BudgetAllocationRow = {
	tag_id: string;
	amount_centavos: number | string;
	tag: { name: string } | Array<{ name: string }> | null;
};

type BudgetActualRow = {
	tag_id: string | null;
	actual_centavos: number | string | null;
};

type RecurringRow = {
	id: string;
	service: string;
	type: "expense" | "income" | "transfer";
	amount_centavos: number | string;
	next_occurrence_at: string;
	from_account_id: string | null;
	to_account_id: string | null;
};

type DebtRow = {
	id: string;
	direction: "loaned" | "owed";
	amount_centavos: number | string;
	settled_centavos: number | string;
	date: string;
	description: string | null;
	person: { name: string } | Array<{ name: string }> | null;
	paid_account_id: string | null;
};

function rows<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

function one<T>(value: unknown): T | null {
	return value && typeof value === "object" ? (value as T) : null;
}

function relationName(value: { name: string } | Array<{ name: string }> | null) {
	if (Array.isArray(value)) return value[0]?.name ?? null;
	return value?.name ?? null;
}

function numberValue(value: number | string | null | undefined) {
	return Number(value ?? 0);
}

function throwOnError(error: QueryError) {
	if (error) throw new Error(error.message);
}

function normalizeName(value: string) {
	return value.trim().toLocaleLowerCase("en-PH");
}

export function createUserSupabaseClient(
	supabaseUrl: string,
	publishableKey: string,
	accessToken: string,
) {
	return createClient(supabaseUrl, publishableKey, {
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
}

export async function validateAccessToken(
	supabaseUrl: string,
	publishableKey: string,
	accessToken: string,
) {
	const client = createClient(supabaseUrl, publishableKey, {
		auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
	});
	const { data, error } = await client.auth.getUser(accessToken);
	return error ? null : data.user;
}

export class SupabaseFinanceDataSource implements FinanceDataSource {
	private readonly client: ReturnType<typeof createUserSupabaseClient>;

	constructor(supabaseUrl: string, publishableKey: string, accessToken: string) {
		this.client = createUserSupabaseClient(supabaseUrl, publishableKey, accessToken);
	}

	async getProfile(): Promise<Profile> {
		const { data, error } = await this.client
			.from("user_profile")
			.select("display_name, timezone")
			.single();
		throwOnError(error);
		const row = one<{ display_name: string; timezone: string }>(data);
		if (!row) throw new Error("Kwartrack profile was not found");
		return { displayName: row.display_name, timezone: row.timezone };
	}

	async getMonthCashFlow(dateFrom: string, dateToExclusive: string) {
		const { data, error } = await this.client.rpc("transaction_month_summary", {
			p_date_from: dateFrom,
			p_date_to_exclusive: dateToExclusive,
			p_account_id: null,
		});
		throwOnError(error);
		const row = rows<{
			net_inflow_centavos: number | string;
			net_outflow_centavos: number | string;
			net_centavos: number | string;
		}>(data)[0];
		return {
			incomeCentavos: numberValue(row?.net_inflow_centavos),
			expenseCentavos: numberValue(row?.net_outflow_centavos),
			netCentavos: numberValue(row?.net_centavos),
		};
	}

	async listAccounts(options: {
		includeArchived: boolean;
		type?: AccountType;
	}): Promise<Account[]> {
		let query = this.client
			.from("account")
			.select(
				"id, name, type, balance_centavos, is_archived, credit_limit_centavos, maturity_date, is_matured, account_group(name)",
			)
			.order("name", { ascending: true });
		if (!options.includeArchived) query = query.eq("is_archived", false);
		if (options.type) query = query.eq("type", options.type);
		const { data, error } = await query;
		throwOnError(error);
		return rows<AccountRow>(data).map((row) => ({
			id: row.id,
			name: row.name,
			type: row.type,
			groupName: relationName(row.account_group),
			balanceCentavos: numberValue(row.balance_centavos),
			isArchived: row.is_archived,
			creditLimitCentavos:
				row.credit_limit_centavos === null ? null : numberValue(row.credit_limit_centavos),
			maturityDate: row.maturity_date,
			isMatured: row.is_matured,
		}));
	}

	private async lookupContext() {
		const [accountsResponse, tagsResponse] = await Promise.all([
			this.client.from("account").select("id, name"),
			this.client.from("tag").select("id, name"),
		]);
		throwOnError(accountsResponse.error);
		throwOnError(tagsResponse.error);
		const accounts = rows<{ id: string; name: string }>(accountsResponse.data);
		const tags = rows<TagRow>(tagsResponse.data);
		return {
			accounts,
			tags,
			accountNames: new Map(accounts.map((account) => [account.id, account.name])),
			tagNames: new Map(tags.map((tag) => [tag.id, tag.name])),
		};
	}

	async searchTransactions(filters: TransactionSearch): Promise<TransactionResult[]> {
		const context = await this.lookupContext();
		const accountId = filters.accountName
			? context.accounts.find(
					(account) => normalizeName(account.name) === normalizeName(filters.accountName ?? ""),
				)?.id
			: undefined;
		const tagId = filters.tagName
			? context.tags.find((tag) => normalizeName(tag.name) === normalizeName(filters.tagName ?? ""))
					?.id
			: undefined;
		if ((filters.accountName && !accountId) || (filters.tagName && !tagId)) return [];

		const sortKey = filters.sort === "largest" || filters.sort === "smallest" ? "amount" : "date";
		const sortDir = filters.sort === "oldest" || filters.sort === "smallest" ? "asc" : "desc";
		const { data, error } = await this.client.rpc("transaction_list", {
			p_type: filters.type ?? null,
			p_tag_id: tagId ?? null,
			p_account_id: accountId ?? null,
			p_group_id: null,
			p_date_from: filters.dateFrom ?? null,
			p_date_to: filters.dateTo ?? null,
			p_split_id: null,
			p_debt_id: null,
			p_search: filters.query ?? "",
			p_sort_key: sortKey,
			p_sort_dir: sortDir,
			p_limit: filters.limit,
			p_offset: 0,
		});
		throwOnError(error);
		return rows<TransactionRow>(data).map((row) => ({
			id: row.id,
			type: row.type,
			amountCentavos: numberValue(row.amount_centavos),
			feeCentavos: row.fee_centavos === null ? null : numberValue(row.fee_centavos),
			description: row.description,
			date: row.date,
			tagName: row.tag_id ? (context.tagNames.get(row.tag_id) ?? null) : null,
			fromAccountName: row.from_account_id
				? (context.accountNames.get(row.from_account_id) ?? null)
				: null,
			toAccountName: row.to_account_id
				? (context.accountNames.get(row.to_account_id) ?? null)
				: null,
			isRecurring: row.recurring_id !== null,
			totalCount: numberValue(row.total_count),
		}));
	}

	async getBudgetStatus(month: string): Promise<BudgetStatus> {
		const [configResponse, allocationResponse, actualResponse] = await Promise.all([
			this.client.from("budget_config").select("overall_centavos").eq("month", month).maybeSingle(),
			this.client
				.from("budget_allocation")
				.select("tag_id, amount_centavos, tag(name)")
				.eq("month", month),
			this.client.from("budget_actuals").select("tag_id, actual_centavos").eq("month", month),
		]);
		throwOnError(configResponse.error);
		throwOnError(allocationResponse.error);
		throwOnError(actualResponse.error);

		const config = one<{ overall_centavos: number | string }>(configResponse.data);
		const actualByTag = new Map(
			rows<BudgetActualRow>(actualResponse.data).map((actual) => [
				actual.tag_id,
				numberValue(actual.actual_centavos),
			]),
		);
		const allocatedTagIds = new Set<string>();
		const allocations = rows<BudgetAllocationRow>(allocationResponse.data).map((allocation) => {
			const tagName = relationName(allocation.tag) ?? "Unknown tag";
			allocatedTagIds.add(allocation.tag_id);
			return {
				tagName,
				budgetCentavos: numberValue(allocation.amount_centavos),
				actualCentavos: actualByTag.get(allocation.tag_id) ?? 0,
			};
		});
		const overallActualCentavos = [...actualByTag.values()].reduce((sum, value) => sum + value, 0);
		const unbudgetedCentavos = [...actualByTag].reduce((sum, [tagId, value]) => {
			return !tagId || !allocatedTagIds.has(tagId) ? sum + value : sum;
		}, 0);
		return {
			month,
			overallBudgetCentavos: numberValue(config?.overall_centavos),
			overallActualCentavos,
			allocations,
			unbudgetedCentavos,
		};
	}

	async listUpcoming(options: {
		from: string;
		to: string;
		timezone: string;
		limit: number;
	}): Promise<UpcomingItem[]> {
		const contextPromise = this.lookupContext();
		const recurringPromise = this.client
			.from("recurring")
			.select(
				"id, service, type, amount_centavos, next_occurrence_at, from_account_id, to_account_id",
			)
			.eq("is_paused", false)
			.eq("is_completed", false)
			.order("next_occurrence_at", { ascending: true })
			.limit(500);
		const debtPromise = this.client
			.from("debt")
			.select(
				"id, direction, amount_centavos, settled_centavos, date, description, person(name), paid_account_id",
			)
			.order("date", { ascending: true })
			.limit(500);
		const [context, recurringResponse, debtResponse] = await Promise.all([
			contextPromise,
			recurringPromise,
			debtPromise,
		]);
		throwOnError(recurringResponse.error);
		throwOnError(debtResponse.error);

		const localDate = (instant: string) => {
			const parts = new Intl.DateTimeFormat("en-CA", {
				timeZone: options.timezone,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}).formatToParts(new Date(instant));
			const value = (type: "year" | "month" | "day") =>
				parts.find((part) => part.type === type)?.value ?? "";
			return `${value("year")}-${value("month")}-${value("day")}`;
		};
		const recurrings: UpcomingItem[] = rows<RecurringRow>(recurringResponse.data)
			.map((row) => {
				const accountId = row.type === "income" ? row.to_account_id : row.from_account_id;
				return {
					id: row.id,
					kind: "recurring" as const,
					name: row.service,
					date: localDate(row.next_occurrence_at),
					amountCentavos: numberValue(row.amount_centavos),
					direction: row.type,
					accountName: accountId ? (context.accountNames.get(accountId) ?? null) : null,
				};
			})
			.filter((row) => row.date >= options.from && row.date <= options.to);
		const debts: UpcomingItem[] = rows<DebtRow>(debtResponse.data)
			.filter((row) => numberValue(row.settled_centavos) < numberValue(row.amount_centavos))
			.map((row) => ({
				id: row.id,
				kind: "debt",
				name: row.description ?? relationName(row.person) ?? "Debt",
				date: row.date,
				amountCentavos: numberValue(row.amount_centavos) - numberValue(row.settled_centavos),
				direction: row.direction,
				accountName: row.paid_account_id
					? (context.accountNames.get(row.paid_account_id) ?? null)
					: null,
			}));
		return [...recurrings, ...debts]
			.sort((left, right) => left.date.localeCompare(right.date))
			.slice(0, options.limit);
	}
}
