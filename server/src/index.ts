import { ScheduleAt } from "spacetimedb";
import { type InferSchema, type ReducerCtx, SenderError, t } from "spacetimedb/server";
import spacetimedb, {
	account,
	budget_allocation,
	budget_config,
	debt,
	recurring_transaction_definition_v2,
	split_event,
	split_participant,
	sub_account,
	time_deposit_metadata,
	transaction,
	user_tag_config,
} from "./schema";

// Re-export the schema as the default export — required by spacetime CLI bundler
// Also re-export fire_recurring_transaction and check_td_maturity so SpacetimeDB can resolve the scheduled reducers
export { check_td_maturity, default, fire_recurring_transaction } from "./schema";

type AppCtx = ReducerCtx<InferSchema<typeof spacetimedb>>;

// Keep this in sync with src/utils/tagConfig.ts DEFAULT_TAGS.
// The server cannot import client utilities, so duplicate the defaults here for validation.
const DEFAULT_TAGS_BY_TYPE: Record<string, readonly string[]> = {
	expense: [
		"foods",
		"grocery",
		"transportation",
		"online-shopping",
		"gadgets",
		"bills",
		"pets",
		"personal-care",
		"health",
		"digital-subscriptions",
		"entertainment",
		"clothing",
		"education",
		"travel",
		"housing",
		"insurance",
		"gifts",
	],
	income: ["monthly-salary", "freelance", "interest", "bonus", "gifts"],
	transfer: [],
};

// =============================================================================
// IDENTITY HELPERS
// Resolves alias → primary identity so all devices share the same data (D-09)
// =============================================================================

function normalizeTagName(tag: string) {
	return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

function resolveOwner(ctx: AppCtx) {
	const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
	return alias?.primaryIdentity ?? ctx.sender;
}

function isAuthorized(ctx: AppCtx, ownerIdentity: ReturnType<typeof resolveOwner>): boolean {
	const resolved = resolveOwner(ctx);
	return ownerIdentity.toHexString() === resolved.toHexString();
}

// applyBalance: applies a debit or credit direction to a sub-account's balanceCentavos.
// Credit sub-accounts use inverted semantics (D-01): expense INCREASES outstanding (0=clean, positive=owed).
// direction "debit" = take money out (expense/transfer-from); "credit" = put money in (income/transfer-to).
// delta is always positive.
function applyBalance(
	subAccount: { balanceCentavos: bigint; subAccountType: string },
	direction: "debit" | "credit",
	delta: bigint,
): bigint {
	const isCreditSubAccount = subAccount.subAccountType === "credit";
	if (direction === "debit") {
		// Non-credit: balance goes down. Credit: outstanding goes up.
		return isCreditSubAccount
			? subAccount.balanceCentavos + delta
			: subAccount.balanceCentavos - delta;
	} else {
		// Non-credit: balance goes up. Credit: outstanding goes down (payment).
		return isCreditSubAccount
			? subAccount.balanceCentavos - delta
			: subAccount.balanceCentavos + delta;
	}
}

// =============================================================================
// VIEWS — data privacy per D-09
// Client subscribes via: 'SELECT * FROM my_accounts', 'SELECT * FROM my_sub_accounts'
// Resolves alias to primary identity so any browser session sees the same data.
// =============================================================================

export const my_accounts = spacetimedb.view(
	{ name: "my_accounts", public: true },
	t.array(account.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.account.account_owner.filter(ownerIdentity)];
	},
);

export const my_sub_accounts = spacetimedb.view(
	{ name: "my_sub_accounts", public: true },
	t.array(sub_account.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.sub_account.sub_account_owner.filter(ownerIdentity)];
	},
);

export const my_transactions = spacetimedb.view(
	{ name: "my_transactions", public: true },
	t.array(transaction.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.transaction.transaction_owner.filter(ownerIdentity)];
	},
);

// my_recurring_definitions: returns all recurring definitions for the calling user.
// Includes both v2 rows (migrated) and v1 rows not yet migrated (represented as v2 shape
// with anchorMonth=0, anchorDayOfWeek=0). This ensures no definitions disappear during
// the incremental migration period.
// Client subscribes via: 'SELECT * FROM my_recurring_definitions'
export const my_recurring_definitions = spacetimedb.view(
	{ name: "my_recurring_definitions", public: true },
	t.array(recurring_transaction_definition_v2.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;

		const v2Rows = [
			...ctx.db.recurring_transaction_definition_v2.recurring_owner_v2.filter(ownerIdentity),
		];
		const v2Ids = new Set(v2Rows.map((r) => r.id));

		// Include v1 rows not yet migrated, mapped to v2 shape with default anchor values
		const unmigratedRows = [
			...ctx.db.recurring_transaction_definition.recurring_owner.filter(ownerIdentity),
		]
			.filter((r) => !v2Ids.has(r.id))
			.map((r) => ({
				id: r.id,
				ownerIdentity: r.ownerIdentity,
				name: r.name,
				type: r.type,
				amountCentavos: r.amountCentavos,
				tag: r.tag,
				subAccountId: r.subAccountId,
				dayOfMonth: r.dayOfMonth,
				interval: r.interval,
				anchorMonth: 0,
				anchorDayOfWeek: 0,
				isPaused: r.isPaused,
				remainingOccurrences: r.remainingOccurrences,
				totalOccurrences: r.totalOccurrences,
				createdAt: r.createdAt,
			}));

		return [...v2Rows, ...unmigratedRows];
	},
);

// my_budget_config: returns the single budget_config row for the current user (D-07)
// Client subscribes via: 'SELECT * FROM my_budget_config'
// CRITICAL: Uses single-column budget_config_owner index — NOT multi-column index (STDB bug)
export const my_budget_config = spacetimedb.view(
	{ name: "my_budget_config", public: true },
	t.array(budget_config.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.budget_config.budget_config_owner.filter(ownerIdentity)];
	},
);

// my_budget_allocations: returns all budget_allocation rows for the current user (D-07)
// Client subscribes via: 'SELECT * FROM my_budget_allocations'
// CRITICAL: Uses single-column budget_allocation_owner index — NOT multi-column index (STDB bug)
export const my_budget_allocations = spacetimedb.view(
	{ name: "my_budget_allocations", public: true },
	t.array(budget_allocation.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.budget_allocation.budget_allocation_owner.filter(ownerIdentity)];
	},
);

// =============================================================================
// DEBT & SPLIT VIEWS
// =============================================================================

export const my_debts = spacetimedb.view(
	{ name: "my_debts", public: true },
	t.array(debt.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.debt.debt_owner.filter(ownerIdentity)];
	},
);

export const my_split_events = spacetimedb.view(
	{ name: "my_split_events", public: true },
	t.array(split_event.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.split_event.split_event_owner.filter(ownerIdentity)];
	},
);

export const my_split_participants = spacetimedb.view(
	{ name: "my_split_participants", public: true },
	t.array(split_participant.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.split_participant.split_participant_owner.filter(ownerIdentity)];
	},
);

export const my_tag_configs = spacetimedb.view(
	{ name: "my_tag_configs", public: true },
	t.array(user_tag_config.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.user_tag_config.tag_config_owner.filter(ownerIdentity)];
	},
);

export const my_time_deposit_metadata = spacetimedb.view(
	{ name: "my_time_deposit_metadata", public: true },
	t.array(time_deposit_metadata.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.time_deposit_metadata.td_metadata_owner.filter(ownerIdentity)];
	},
);

// =============================================================================
// TRANSACTION REDUCERS
// D-22 balance update formulas:
//   Expense:  source.balanceCentavos -= (amountCentavos + serviceFeeCentavos)
//   Income:   destination.balanceCentavos += amountCentavos
//   Transfer: source -= (amount + serviceFee), destination += amount
// =============================================================================

export const create_transaction = spacetimedb.reducer(
	{
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		sourceSubAccountId: t.u64(),
		destinationSubAccountId: t.u64(),
		serviceFeeCentavos: t.i64(),
		description: t.string(),
		date: t.timestamp(),
	},
	(
		ctx,
		{
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
		},
	) => {
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (!tag.trim()) throw new SenderError("Tag is required");

		const ownerIdentity = resolveOwner(ctx);

		// Validate and update source sub-account (expense, transfer)
		if (type === "expense" || type === "transfer") {
			const source = ctx.db.sub_account.id.find(sourceSubAccountId);
			if (!source) throw new SenderError("Source sub-account not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			const debit = amountCentavos + serviceFeeCentavos;
			ctx.db.sub_account.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", debit),
			});
		}

		// Validate and update destination sub-account (income, transfer)
		if (type === "income" || type === "transfer") {
			const destination = ctx.db.sub_account.id.find(destinationSubAccountId);
			if (!destination) throw new SenderError("Destination sub-account not found");
			if (!isAuthorized(ctx, destination.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.sub_account.id.update({
				...destination,
				balanceCentavos: applyBalance(destination, "credit", amountCentavos),
			});
		}

		ctx.db.transaction.insert({
			id: 0n,
			ownerIdentity,
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
			createdAt: ctx.timestamp,
			isRecurring: false, // manually created transactions are never recurring
			recurringDefinitionId: 0n, // 0n sentinel for non-recurring (D-10)
		});
	},
);

export const edit_transaction = spacetimedb.reducer(
	{
		transactionId: t.u64(),
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		sourceSubAccountId: t.u64(),
		destinationSubAccountId: t.u64(),
		serviceFeeCentavos: t.i64(),
		description: t.string(),
		date: t.timestamp(),
	},
	(
		ctx,
		{
			transactionId,
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
		},
	) => {
		const existing = ctx.db.transaction.id.find(transactionId);
		if (!existing) throw new SenderError("Transaction not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");

		// --- Reverse old transaction's balance effect ---
		if (existing.type === "expense" || existing.type === "transfer") {
			const oldSource = ctx.db.sub_account.id.find(existing.sourceSubAccountId);
			if (oldSource) {
				const oldDebit = existing.amountCentavos + existing.serviceFeeCentavos;
				ctx.db.sub_account.id.update({
					...oldSource,
					balanceCentavos: applyBalance(oldSource, "credit", oldDebit), // reversal = opposite direction
				});
			}
		}
		if (existing.type === "income" || existing.type === "transfer") {
			const oldDest = ctx.db.sub_account.id.find(existing.destinationSubAccountId);
			if (oldDest) {
				ctx.db.sub_account.id.update({
					...oldDest,
					balanceCentavos: applyBalance(oldDest, "debit", existing.amountCentavos), // reversal = opposite direction
				});
			}
		}

		// --- Apply new transaction's balance effect ---
		if (type === "expense" || type === "transfer") {
			const source = ctx.db.sub_account.id.find(sourceSubAccountId);
			if (!source) throw new SenderError("Source sub-account not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			const debit = amountCentavos + serviceFeeCentavos;
			ctx.db.sub_account.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", debit),
			});
		}
		if (type === "income" || type === "transfer") {
			const dest = ctx.db.sub_account.id.find(destinationSubAccountId);
			if (!dest) throw new SenderError("Destination sub-account not found");
			if (!isAuthorized(ctx, dest.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.sub_account.id.update({
				...dest,
				balanceCentavos: applyBalance(dest, "credit", amountCentavos),
			});
		}

		ctx.db.transaction.id.update({
			...existing,
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
		});
	},
);

export const delete_transaction = spacetimedb.reducer(
	{ transactionId: t.u64() },
	(ctx, { transactionId }) => {
		const existing = ctx.db.transaction.id.find(transactionId);
		if (!existing) throw new SenderError("Transaction not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// Reverse balance effect (opposite direction to undo the original transaction)
		if (existing.type === "expense" || existing.type === "transfer") {
			const source = ctx.db.sub_account.id.find(existing.sourceSubAccountId);
			if (source) {
				const debit = existing.amountCentavos + existing.serviceFeeCentavos;
				ctx.db.sub_account.id.update({
					...source,
					balanceCentavos: applyBalance(source, "credit", debit), // undo the debit
				});
			}
		}
		if (existing.type === "income" || existing.type === "transfer") {
			const dest = ctx.db.sub_account.id.find(existing.destinationSubAccountId);
			if (dest) {
				ctx.db.sub_account.id.update({
					...dest,
					balanceCentavos: applyBalance(dest, "debit", existing.amountCentavos), // undo the credit
				});
			}
		}

		ctx.db.transaction.id.delete(transactionId);
	},
);

// =============================================================================
// ACCOUNT REDUCERS
// =============================================================================

// create_account
// Client: conn.reducers.createAccount({ name: 'Maya', initialBalanceCentavos: 12050000n })
// If initialBalanceCentavos > 0n => isStandalone=true, hidden default sub-account auto-created (D-04)
// If initialBalanceCentavos === 0n => isStandalone=false, no sub-accounts created
export const create_account = spacetimedb.reducer(
	{ name: t.string(), initialBalanceCentavos: t.i64(), iconBankId: t.string().optional() },
	(ctx, { name, initialBalanceCentavos, iconBankId }) => {
		if (!name.trim()) throw new SenderError("Account name is required");

		const ownerIdentity = resolveOwner(ctx);
		const isStandalone = initialBalanceCentavos > 0n;
		const accountRow = ctx.db.account.insert({
			id: 0n,
			ownerIdentity,
			name: name.trim(),
			isStandalone,
			iconBankId,
			createdAt: ctx.timestamp,
		});

		if (isStandalone) {
			// Hidden default sub-account stores the initial balance (D-04)
			ctx.db.sub_account.insert({
				id: 0n,
				accountId: accountRow.id,
				ownerIdentity,
				name: "__default__",
				balanceCentavos: initialBalanceCentavos,
				isDefault: true,
				createdAt: ctx.timestamp,
				subAccountType: "wallet",
				creditLimitCentavos: 0n,
			});
		}
	},
);

// rename_account
// Client: conn.reducers.renameAccount({ accountId: 1n, newName: 'Maya GCash' })
export const rename_account = spacetimedb.reducer(
	{ accountId: t.u64(), newName: t.string() },
	(ctx, { accountId, newName }) => {
		if (!newName.trim()) throw new SenderError("Account name is required");
		const existing = ctx.db.account.id.find(accountId);
		if (!existing) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		ctx.db.account.id.update({ ...existing, name: newName.trim() });
	},
);

// update_account_icon
// Client: conn.reducers.updateAccountIcon({ accountId: 1n, iconBankId: 'bdo' })
// Pass iconBankId: undefined to clear the icon.
export const update_account_icon = spacetimedb.reducer(
	{ accountId: t.u64(), iconBankId: t.string().optional() },
	(ctx, { accountId, iconBankId }) => {
		const ownerIdentity = resolveOwner(ctx);
		const existing = ctx.db.account.id.find(accountId);
		if (!existing) throw new SenderError("Account not found");
		if (existing.ownerIdentity.toHexString() !== ownerIdentity.toHexString()) {
			throw new SenderError("Not authorized");
		}
		ctx.db.account.id.update({ ...existing, iconBankId });
	},
);

// delete_account
// Client: conn.reducers.deleteAccount({ accountId: 1n })
// Cascades: deletes all sub-accounts (including hidden default sub-account) first (D-15)
export const delete_account = spacetimedb.reducer({ accountId: t.u64() }, (ctx, { accountId }) => {
	const existing = ctx.db.account.id.find(accountId);
	if (!existing) throw new SenderError("Account not found");
	if (!isAuthorized(ctx, existing.ownerIdentity)) {
		throw new SenderError("Not authorized");
	}
	for (const sa of ctx.db.sub_account.sub_account_account.filter(accountId)) {
		ctx.db.sub_account.id.delete(sa.id);
	}
	ctx.db.account.id.delete(accountId);
});

// =============================================================================
// SUB-ACCOUNT REDUCERS
// =============================================================================

// add_sub_account
// Client: conn.reducers.addSubAccount({ accountId: 1n, name: 'Savings', initialBalanceCentavos: 0n, subAccountType: 'savings', creditLimitCentavos: 0n })
// Only for non-standalone accounts. For standalone accounts, use convert_and_create_sub_account.
export const add_sub_account = spacetimedb.reducer(
	{
		accountId: t.u64(),
		name: t.string(),
		initialBalanceCentavos: t.i64(),
		subAccountType: t.string(), // 'wallet' | 'savings' | 'time-deposit' | 'credit'
		creditLimitCentavos: t.i64(),
	},
	(ctx, { accountId, name, initialBalanceCentavos, subAccountType, creditLimitCentavos }) => {
		if (!name.trim()) throw new SenderError("Sub-account name is required");
		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) throw new SenderError("Not authorized");
		if (acc.isStandalone)
			throw new SenderError("Account is standalone — use convert_and_create_sub_account");

		const ownerIdentity = resolveOwner(ctx);

		ctx.db.sub_account.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: name.trim(),
			balanceCentavos: initialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			subAccountType: subAccountType || "wallet",
			creditLimitCentavos: creditLimitCentavos ?? 0n,
		});
	},
);

// convert_and_create_sub_account
// Called when adding the first sub-account to a standalone account.
// Atomically: converts hidden default sub-account → visible (or deletes if balance=0),
// marks account as non-standalone, and inserts the new sub-account.
// Client: conn.reducers.convertAndCreateSubAccount({ accountId: 1n, newName: 'Savings', newSubAccountType: 'savings', newCreditLimitCentavos: 0n, existingName: 'Main', existingSubAccountType: 'wallet' })
export const convert_and_create_sub_account = spacetimedb.reducer(
	{
		accountId: t.u64(),
		newName: t.string(),
		newSubAccountType: t.string(),
		newCreditLimitCentavos: t.i64(),
		newSubAccountInitialBalanceCentavos: t.i64(),
		existingName: t.string(),
		existingSubAccountType: t.string(),
	},
	(
		ctx,
		{
			accountId,
			newName,
			newSubAccountType,
			newCreditLimitCentavos,
			newSubAccountInitialBalanceCentavos,
			existingName,
			existingSubAccountType,
		},
	) => {
		if (!newName.trim()) throw new SenderError("Sub-account name is required");
		if (existingSubAccountType === "credit")
			throw new SenderError("Cannot convert default sub-account to credit type");
		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) throw new SenderError("Not authorized");
		if (!acc.isStandalone) throw new SenderError("Account is not standalone");

		const ownerIdentity = resolveOwner(ctx);

		// Find the hidden default sub-account ID via index, then fetch full row for update
		let defaultSubAccountId: bigint | undefined;
		for (const sa of ctx.db.sub_account.sub_account_account.filter(accountId)) {
			if (sa.isDefault) {
				defaultSubAccountId = sa.id;
				break;
			}
		}

		if (defaultSubAccountId !== undefined) {
			const defaultSubAccount = ctx.db.sub_account.id.find(defaultSubAccountId);
			if (defaultSubAccount) {
				if (defaultSubAccount.balanceCentavos > 0n) {
					// Convert: make the hidden default visible with the user's chosen name
					ctx.db.sub_account.id.update({
						...defaultSubAccount,
						name: existingName.trim() || "Main",
						isDefault: false,
						subAccountType: existingSubAccountType || "wallet",
					});
				} else {
					// Zero balance: just remove the hidden default
					ctx.db.sub_account.id.delete(defaultSubAccountId);
				}
			}
		}

		// Mark account as no longer standalone
		ctx.db.account.id.update({ ...acc, isStandalone: false });

		// Insert the new sub-account with the user-supplied initial balance
		ctx.db.sub_account.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: newName.trim(),
			balanceCentavos: newSubAccountInitialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			subAccountType: newSubAccountType || "wallet",
			creditLimitCentavos: newSubAccountType === "credit" ? newCreditLimitCentavos : 0n,
		});
	},
);

// rename_sub_account
export const rename_sub_account = spacetimedb.reducer(
	{ subAccountId: t.u64(), newName: t.string() },
	(ctx, { subAccountId, newName }) => {
		if (!newName.trim()) throw new SenderError("Sub-account name is required");
		const existing = ctx.db.sub_account.id.find(subAccountId);
		if (!existing) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		ctx.db.sub_account.id.update({ ...existing, name: newName.trim() });
	},
);

// edit_sub_account — update name, credit limit, and optionally outstanding balance
export const edit_sub_account = spacetimedb.reducer(
	{
		subAccountId: t.u64(),
		newName: t.string(),
		newCreditLimitCentavos: t.i64(),
		newBalanceCentavos: t.i64().optional(),
	},
	(ctx, { subAccountId, newName, newCreditLimitCentavos, newBalanceCentavos }) => {
		if (!newName.trim()) throw new SenderError("Sub-account name is required");
		if (newCreditLimitCentavos <= 0n) throw new SenderError("Credit limit must be greater than 0");
		const existing = ctx.db.sub_account.id.find(subAccountId);
		if (!existing) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (existing.subAccountType !== "credit")
			throw new SenderError("Only credit sub-accounts can be edited");
		if (newBalanceCentavos != null && newBalanceCentavos < 0n)
			throw new SenderError("Outstanding balance cannot be negative");
		if (newBalanceCentavos != null && newBalanceCentavos > newCreditLimitCentavos)
			throw new SenderError("Outstanding balance cannot exceed credit limit");
		ctx.db.sub_account.id.update({
			...existing,
			name: newName.trim(),
			creditLimitCentavos: newCreditLimitCentavos,
			...(newBalanceCentavos != null ? { balanceCentavos: newBalanceCentavos } : {}),
		});
	},
);

// delete_sub_account
export const delete_sub_account = spacetimedb.reducer(
	{ subAccountId: t.u64() },
	(ctx, { subAccountId }) => {
		const existing = ctx.db.sub_account.id.find(subAccountId);
		if (!existing) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// If time deposit: clean up metadata and recurring definition
		const meta = ctx.db.time_deposit_metadata.subAccountId.find(subAccountId);
		if (meta) {
			for (const sched of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
				meta.recurringDefinitionId,
			)) {
				ctx.db.recurring_transaction_schedule.scheduledId.delete(sched.scheduledId);
			}
			ctx.db.recurring_transaction_definition_v2.id.delete(meta.recurringDefinitionId);
			ctx.db.time_deposit_metadata.subAccountId.delete(subAccountId);
		}

		ctx.db.sub_account.id.delete(subAccountId);
	},
);

// create_time_deposit
// Creates a time deposit sub-account + recurring income definition + metadata row atomically.
// Monthly net interest = principal × (interestRateBps / 10_000) / 12 × 0.80
// Integer: (principal × bps × 80n) / 12_000_000n
// Client: conn.reducers.createTimeDeposit({ accountId, name, initialBalanceCentavos, interestRateBps, maturityDate })
export const create_time_deposit = spacetimedb.reducer(
	{
		accountId: t.u64(),
		name: t.string(),
		initialBalanceCentavos: t.i64(),
		interestRateBps: t.u32(),
		maturityDate: t.timestamp(),
	},
	(ctx, { accountId, name, initialBalanceCentavos, interestRateBps, maturityDate }) => {
		if (!name.trim()) throw new SenderError("Sub-account name is required");
		if (initialBalanceCentavos <= 0n)
			throw new SenderError("Initial balance must be greater than 0");
		if (interestRateBps === 0) throw new SenderError("Interest rate is required");
		if (maturityDate.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch)
			throw new SenderError("Maturity date must be in the future");

		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) throw new SenderError("Not authorized");
		if (acc.isStandalone)
			throw new SenderError("Account is standalone — use convert_and_create_sub_account");

		const ownerIdentity = resolveOwner(ctx);

		// 1. Create the sub-account
		const subAccountRow = ctx.db.sub_account.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: name.trim(),
			balanceCentavos: initialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			subAccountType: "time-deposit",
			creditLimitCentavos: 0n,
		});

		// 2. Compute monthly net interest
		const monthlyNetCentavos =
			(initialBalanceCentavos * BigInt(interestRateBps) * 80n) / 12_000_000n;
		if (monthlyNetCentavos <= 0n)
			throw new SenderError("Computed monthly interest is zero — check rate and balance");

		// 3. Create recurring income definition (same ID strategy as create_recurring_definition)
		let maxId = 0n;
		for (const row of ctx.db.recurring_transaction_definition.iter()) {
			if (row.id > maxId) maxId = row.id;
		}
		for (const row of ctx.db.recurring_transaction_definition_v2.iter()) {
			if (row.id > maxId) maxId = row.id;
		}

		const defRow = ctx.db.recurring_transaction_definition_v2.insert({
			id: maxId + 1n,
			ownerIdentity,
			name: `${name.trim()} — Interest`,
			type: "income",
			amountCentavos: monthlyNetCentavos,
			tag: "interest",
			subAccountId: subAccountRow.id,
			dayOfMonth: 1,
			interval: "monthly",
			anchorMonth: 0,
			anchorDayOfWeek: 0,
			isPaused: false,
			remainingOccurrences: 0,
			totalOccurrences: 0,
			createdAt: ctx.timestamp,
		});

		// 4. Schedule first fire
		const firstFireMicros = computeFirstFireMicros(
			ctx.timestamp.microsSinceUnixEpoch,
			1,
			"monthly",
			0,
			0,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(firstFireMicros),
			definitionId: defRow.id,
		});

		// 5. Insert metadata row
		ctx.db.time_deposit_metadata.insert({
			subAccountId: subAccountRow.id,
			ownerIdentity,
			interestRateBps,
			maturityDate,
			recurringDefinitionId: defRow.id,
			isMatured: false,
			principalCentavos: initialBalanceCentavos,
			createdAt: ctx.timestamp,
		});
	},
);

// edit_time_deposit_metadata
// Updates interest rate and/or maturity date. Recomputes monthly amount if rate changed.
// Resumes interest posting if maturity extended past now and TD was already matured.
// Client: conn.reducers.editTimeDepositMetadata({ subAccountId, interestRateBps, maturityDate })
export const edit_time_deposit_metadata = spacetimedb.reducer(
	{
		subAccountId: t.u64(),
		interestRateBps: t.u32(),
		maturityDate: t.timestamp(),
	},
	(ctx, { subAccountId, interestRateBps, maturityDate }) => {
		const meta = ctx.db.time_deposit_metadata.subAccountId.find(subAccountId);
		if (!meta) throw new SenderError("Time deposit metadata not found");
		if (!isAuthorized(ctx, meta.ownerIdentity)) throw new SenderError("Not authorized");
		if (interestRateBps === 0) throw new SenderError("Interest rate is required");

		let updatedMeta = { ...meta, maturityDate, interestRateBps };

		// Read def once; accumulate all mutations before writing
		const def = ctx.db.recurring_transaction_definition_v2.id.find(meta.recurringDefinitionId);
		let defUpdate = def ? { ...def } : null;

		// If rate changed, recompute monthly net interest using original principal
		if (interestRateBps !== meta.interestRateBps) {
			const newMonthlyNetCentavos =
				(meta.principalCentavos * BigInt(interestRateBps) * 80n) / 12_000_000n;
			if (newMonthlyNetCentavos <= 0n)
				throw new SenderError("Computed monthly interest is zero — check rate and balance");
			if (defUpdate) defUpdate = { ...defUpdate, amountCentavos: newMonthlyNetCentavos };
		}

		// If maturity extended past now and TD was already matured, resume posting
		const nowMicros = ctx.timestamp.microsSinceUnixEpoch;
		if (meta.isMatured && maturityDate.microsSinceUnixEpoch > nowMicros) {
			if (defUpdate?.isPaused) {
				defUpdate = { ...defUpdate, isPaused: false };
				const nextFireMicros = computeFirstFireMicros(nowMicros, 1, "monthly", 0, 0);
				ctx.db.recurring_transaction_schedule.insert({
					scheduledId: 0n,
					scheduledAt: ScheduleAt.time(nextFireMicros),
					definitionId: meta.recurringDefinitionId,
				});
			}
			updatedMeta = { ...updatedMeta, isMatured: false };
		}

		// Single write for recurring definition if it changed
		if (defUpdate && def) {
			ctx.db.recurring_transaction_definition_v2.id.update(defUpdate);
		}

		ctx.db.time_deposit_metadata.subAccountId.update(updatedMeta);
	},
);

// =============================================================================
// IDENTITY REDUCERS
// =============================================================================

// link_clerk_identity
// Client: conn.reducers.linkClerkIdentity({ clerkUserId: 'user_2abc...', displayName: 'Alice' })
// Called on every connect. Registers this STDB identity as an alias of the primary identity
// for this Clerk user. Never transfers data ownership — all devices always share the same
// primary identity's data, enabling true multi-device/multi-browser concurrent access.
export const link_clerk_identity = spacetimedb.reducer(
	{ clerkUserId: t.string(), displayName: t.string() },
	(ctx, { clerkUserId, displayName }) => {
		if (!clerkUserId.trim()) throw new SenderError("clerkUserId is required");

		// If this STDB identity is already registered, just update display name if needed
		const existingAlias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		if (existingAlias) {
			const profile = ctx.db.userProfile.identity.find(existingAlias.primaryIdentity);
			if (profile && profile.displayName !== displayName) {
				ctx.db.userProfile.identity.update({ ...profile, displayName });
			}
			return;
		}

		const existingProfile = ctx.db.userProfile.clerkUserId.find(clerkUserId);

		if (!existingProfile) {
			// First-time user: this identity becomes the primary
			ctx.db.userProfile.insert({
				identity: ctx.sender,
				clerkUserId,
				displayName,
				createdAt: ctx.timestamp,
			});
			ctx.db.identity_alias.insert({
				stdbIdentity: ctx.sender,
				primaryIdentity: ctx.sender,
				clerkUserId,
			});
			return;
		}

		// Known Clerk user, new device/browser: register as alias of existing primary
		// Data stays owned by primaryIdentity — no ownership transfer needed
		ctx.db.identity_alias.insert({
			stdbIdentity: ctx.sender,
			primaryIdentity: existingProfile.identity,
			clerkUserId,
		});
		if (existingProfile.displayName !== displayName) {
			ctx.db.userProfile.identity.update({ ...existingProfile, displayName });
		}
	},
);

// =============================================================================
// RECURRING TRANSACTION REDUCERS
// Five CRUD reducers for recurring_transaction_definition_v2 (RECR-01, RECR-03)
// =============================================================================

// migrateV1RowToV2: incremental migration helper.
// Checks v2 first; if the row is missing, copies it from v1 with anchorMonth=0, anchorDayOfWeek=0.
// Returns the v2 row, or undefined if not found in either table.
// Called by every write reducer that accesses a recurring definition.
function migrateV1RowToV2(ctx: AppCtx, definitionId: bigint) {
	const v2 = ctx.db.recurring_transaction_definition_v2.id.find(definitionId);
	if (v2) return v2;
	const v1 = ctx.db.recurring_transaction_definition.id.find(definitionId);
	if (!v1) return undefined;
	return ctx.db.recurring_transaction_definition_v2.insert({
		id: v1.id,
		ownerIdentity: v1.ownerIdentity,
		name: v1.name,
		type: v1.type,
		amountCentavos: v1.amountCentavos,
		tag: v1.tag,
		subAccountId: v1.subAccountId,
		dayOfMonth: v1.dayOfMonth,
		interval: v1.interval,
		anchorMonth: 0,
		anchorDayOfWeek: 0,
		isPaused: v1.isPaused,
		remainingOccurrences: v1.remainingOccurrences,
		totalOccurrences: v1.totalOccurrences,
		createdAt: v1.createdAt,
	});
}

// Compute the microsecond timestamp for the first fire of a new/resumed definition.
// Dispatch order:
//   1. weekly/biweekly + anchorDayOfWeek > 0 → next occurrence of that weekday
//   2. quarterly + anchorMonth > 0 → next future occurrence in the 4-month cycle
//   3. semiannual/yearly + anchorMonth > 0 → next future (anchorMonth, dayOfMonth) or +6mo pair
//   4. default → this month if dayOfMonth >= today, else next month
function computeFirstFireMicros(
	nowMicros: bigint,
	dayOfMonth: number,
	interval: string,
	anchorMonth: number,
	anchorDayOfWeek: number,
): bigint {
	const nowMs = Number(nowMicros / 1000n);
	const now = new Date(nowMs);

	// Case 1: weekly/biweekly with day-of-week anchor
	if (anchorDayOfWeek > 0 && (interval === "weekly" || interval === "biweekly")) {
		// anchorDayOfWeek 1=Mon..6=Sat, 7=Sun → JS getUTCDay() 1=Mon..6=Sat, 0=Sun
		const targetJsDay = anchorDayOfWeek === 7 ? 0 : anchorDayOfWeek;
		const todayJsDay = now.getUTCDay();
		const daysUntil = (targetJsDay - todayJsDay + 7) % 7;
		const targetMs = now.getTime() + daysUntil * 24 * 60 * 60 * 1000;
		const target = new Date(targetMs);
		const fireDate = new Date(
			Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0, 0),
		);
		return BigInt(fireDate.getTime()) * 1000n;
	}

	// Case 2: quarterly with month anchor — fires on anchorMonth, anchorMonth+3, anchorMonth+6, anchorMonth+9
	if (anchorMonth > 0 && interval === "quarterly") {
		const currentYear = now.getUTCFullYear();
		const m0 = anchorMonth - 1; // 0-indexed month
		const fireMonths = [m0, (m0 + 3) % 12, (m0 + 6) % 12, (m0 + 9) % 12];
		const candidates: bigint[] = [];
		for (const y of [currentYear, currentYear + 1]) {
			for (const m of fireMonths) {
				const d = new Date(Date.UTC(y, m, dayOfMonth, 0, 0, 0, 0));
				if (d > now) candidates.push(BigInt(d.getTime()) * 1000n);
			}
		}
		const sorted = candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		if (sorted.length === 0)
			throw new Error(
				`computeFirstFireMicros: no quarterly candidate found for anchorMonth=${anchorMonth}`,
			);
		return sorted[0];
	}

	// Case 3: semiannual/yearly with month anchor
	if (anchorMonth > 0 && (interval === "semiannual" || interval === "yearly")) {
		const currentYear = now.getUTCFullYear();
		const m0 = anchorMonth - 1; // 0-indexed month

		if (interval === "yearly") {
			for (const y of [currentYear, currentYear + 1]) {
				const d = new Date(Date.UTC(y, m0, dayOfMonth, 0, 0, 0, 0));
				if (d > now) return BigInt(d.getTime()) * 1000n;
			}
			// Unreachable with valid dayOfMonth (1–28), but guard for clarity
			throw new Error(
				`computeFirstFireMicros: no future yearly date found for anchorMonth=${anchorMonth}`,
			);
		}

		// semiannual fires on anchorMonth and anchorMonth+6 months
		const m1 = m0;
		const m2 = (m0 + 6) % 12;
		const candidates: bigint[] = [];
		for (const y of [currentYear, currentYear + 1]) {
			for (const m of [m1, m2]) {
				const d = new Date(Date.UTC(y, m, dayOfMonth, 0, 0, 0, 0));
				if (d > now) candidates.push(BigInt(d.getTime()) * 1000n);
			}
		}
		const sorted = candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		if (sorted.length === 0)
			throw new Error(
				`computeFirstFireMicros: no semiannual candidate found for anchorMonth=${anchorMonth}`,
			);
		return sorted[0];
	}

	// Case 4: default — fire this month or next month based on dayOfMonth
	const todayDay = now.getUTCDate();
	let targetYear = now.getUTCFullYear();
	let targetMonth = now.getUTCMonth();
	if (dayOfMonth < todayDay) {
		targetMonth += 1;
		if (targetMonth > 11) {
			targetMonth = 0;
			targetYear += 1;
		}
	}
	const fireDate = new Date(Date.UTC(targetYear, targetMonth, dayOfMonth, 0, 0, 0, 0));
	return BigInt(fireDate.getTime()) * 1000n;
}

// create_recurring_definition
// Client: conn.reducers.createRecurringDefinition({ name, type, amountCentavos, tag, subAccountId, dayOfMonth, interval, anchorMonth, anchorDayOfWeek, remainingOccurrences, totalOccurrences })
export const create_recurring_definition = spacetimedb.reducer(
	{
		name: t.string(),
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		subAccountId: t.u64(),
		dayOfMonth: t.u8(),
		interval: t.string(),
		anchorMonth: t.u8(),
		anchorDayOfWeek: t.u8(),
		remainingOccurrences: t.u16(),
		totalOccurrences: t.u16(),
	},
	(
		ctx,
		{
			name,
			type,
			amountCentavos,
			tag,
			subAccountId,
			dayOfMonth,
			interval,
			anchorMonth,
			anchorDayOfWeek,
			remainingOccurrences,
			totalOccurrences,
		},
	) => {
		if (!name.trim()) throw new SenderError("Name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (dayOfMonth < 1 || dayOfMonth > 28) throw new SenderError("Day must be 1–28");

		const ownerIdentity = resolveOwner(ctx);

		// Compute a safe ID: max across both v1 and v2 + 1.
		// autoInc on v2 doesn't track explicit IDs inserted by migrateV1RowToV2,
		// so starting from 0n risks colliding with an unmigrated v1 row and hiding
		// it from the view's deduplication filter.
		let maxId = 0n;
		for (const row of ctx.db.recurring_transaction_definition.iter()) {
			if (row.id > maxId) maxId = row.id;
		}
		for (const row of ctx.db.recurring_transaction_definition_v2.iter()) {
			if (row.id > maxId) maxId = row.id;
		}

		const defRow = ctx.db.recurring_transaction_definition_v2.insert({
			id: maxId + 1n,
			ownerIdentity,
			name: name.trim(),
			type,
			amountCentavos,
			tag,
			subAccountId,
			dayOfMonth,
			interval,
			anchorMonth,
			anchorDayOfWeek,
			isPaused: false,
			remainingOccurrences,
			totalOccurrences,
			createdAt: ctx.timestamp,
		});

		// Schedule the first fire
		const firstFireMicros = computeFirstFireMicros(
			ctx.timestamp.microsSinceUnixEpoch,
			dayOfMonth,
			interval,
			anchorMonth,
			anchorDayOfWeek,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(firstFireMicros),
			definitionId: defRow.id,
		});
	},
);

// edit_recurring_definition
// Client: conn.reducers.editRecurringDefinition({ definitionId, name, type, amountCentavos, tag, subAccountId, dayOfMonth, interval, anchorMonth, anchorDayOfWeek, remainingOccurrences })
export const edit_recurring_definition = spacetimedb.reducer(
	{
		definitionId: t.u64(),
		name: t.string(),
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		subAccountId: t.u64(),
		dayOfMonth: t.u8(),
		interval: t.string(),
		anchorMonth: t.u8(),
		anchorDayOfWeek: t.u8(),
		remainingOccurrences: t.u16(),
	},
	(
		ctx,
		{
			definitionId,
			name,
			type,
			amountCentavos,
			tag,
			subAccountId,
			dayOfMonth,
			interval,
			anchorMonth,
			anchorDayOfWeek,
			remainingOccurrences,
		},
	) => {
		const existing = migrateV1RowToV2(ctx, definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (!name.trim()) throw new SenderError("Name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (dayOfMonth < 1 || dayOfMonth > 28) throw new SenderError("Day must be 1–28");

		ctx.db.recurring_transaction_definition_v2.id.update({
			...existing,
			name: name.trim(),
			type,
			amountCentavos,
			tag,
			subAccountId,
			dayOfMonth,
			interval,
			anchorMonth,
			anchorDayOfWeek,
			remainingOccurrences,
		});

		// Reschedule if any scheduling field changed on an active definition
		const needsReschedule =
			(interval !== existing.interval ||
				dayOfMonth !== existing.dayOfMonth ||
				anchorMonth !== existing.anchorMonth ||
				anchorDayOfWeek !== existing.anchorDayOfWeek) &&
			!existing.isPaused;

		if (needsReschedule) {
			for (const schedRow of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
				existing.id,
			)) {
				ctx.db.recurring_transaction_schedule.scheduledId.delete(schedRow.scheduledId);
			}
			const nextFireMicros = computeFirstFireMicros(
				ctx.timestamp.microsSinceUnixEpoch,
				dayOfMonth,
				interval,
				anchorMonth,
				anchorDayOfWeek,
			);
			ctx.db.recurring_transaction_schedule.insert({
				scheduledId: 0n,
				scheduledAt: ScheduleAt.time(nextFireMicros),
				definitionId: existing.id,
			});
		}
	},
);

// delete_recurring_definition
// Client: conn.reducers.deleteRecurringDefinition({ definitionId })
export const delete_recurring_definition = spacetimedb.reducer(
	{ definitionId: t.u64() },
	(ctx, { definitionId }) => {
		const existing = migrateV1RowToV2(ctx, definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// Delete associated schedule row(s) if any (D-07)
		for (const schedRow of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
			definitionId,
		)) {
			ctx.db.recurring_transaction_schedule.scheduledId.delete(schedRow.scheduledId);
		}

		ctx.db.recurring_transaction_definition_v2.id.delete(definitionId);
		// Also remove from v1 to prevent the view from re-surfacing the deleted row
		ctx.db.recurring_transaction_definition.id.delete(definitionId);
	},
);

// pause_recurring_definition
// Client: conn.reducers.pauseRecurringDefinition({ definitionId })
// D-07: Pausing deletes the schedule row and sets isPaused: true
export const pause_recurring_definition = spacetimedb.reducer(
	{ definitionId: t.u64() },
	(ctx, { definitionId }) => {
		const existing = migrateV1RowToV2(ctx, definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (existing.isPaused) return;

		for (const schedRow of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
			definitionId,
		)) {
			ctx.db.recurring_transaction_schedule.scheduledId.delete(schedRow.scheduledId);
		}

		ctx.db.recurring_transaction_definition_v2.id.update({ ...existing, isPaused: true });
	},
);

// resume_recurring_definition
// Client: conn.reducers.resumeRecurringDefinition({ definitionId })
// D-07: Resuming inserts a new schedule row for the next upcoming fire date and clears isPaused
export const resume_recurring_definition = spacetimedb.reducer(
	{ definitionId: t.u64() },
	(ctx, { definitionId }) => {
		const existing = migrateV1RowToV2(ctx, definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (!existing.isPaused) return;

		const nextFireMicros = computeFirstFireMicros(
			ctx.timestamp.microsSinceUnixEpoch,
			existing.dayOfMonth,
			existing.interval,
			existing.anchorMonth,
			existing.anchorDayOfWeek,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextFireMicros),
			definitionId: existing.id,
		});

		ctx.db.recurring_transaction_definition_v2.id.update({ ...existing, isPaused: false });
	},
);

// =============================================================================
// BUDGET REDUCERS (BUDG-01)
// =============================================================================

// set_budget: upsert the user's budget_config row (one row per user — D-04)
// Client: conn.reducers.setBudget({ totalCentavos: 2000000n })
// totalCentavos = 0n means "no total set" / disable budget
export const set_budget = spacetimedb.reducer(
	{ totalCentavos: t.i64() },
	(ctx, { totalCentavos }) => {
		const ownerIdentity = resolveOwner(ctx);
		const existing = [...ctx.db.budget_config.budget_config_owner.filter(ownerIdentity)][0];
		if (existing) {
			ctx.db.budget_config.id.update({ ...existing, totalCentavos, updatedAt: ctx.timestamp });
		} else {
			ctx.db.budget_config.insert({
				id: 0n,
				ownerIdentity,
				totalCentavos,
				updatedAt: ctx.timestamp,
			});
		}
	},
);

// set_budget_allocations: batch replace all budget_allocation rows for the user (D-05)
// Client: conn.reducers.setBudgetAllocations({ allocations: [{ tag: 'grocery', allocatedCentavos: 500000n }] })
// Deletes all existing allocations for this user then re-inserts only those with allocatedCentavos > 0n.
// CRITICAL: Uses single-column budget_allocation_owner index for deletion — NOT multi-column index (STDB bug)
export const set_budget_allocations = spacetimedb.reducer(
	{
		allocations: t.array(
			t.object("BudgetAllocationInput", { tag: t.string(), allocatedCentavos: t.i64() }),
		),
	},
	(ctx, { allocations }) => {
		const ownerIdentity = resolveOwner(ctx);
		// Delete all existing allocations for this user
		for (const row of ctx.db.budget_allocation.budget_allocation_owner.filter(ownerIdentity)) {
			ctx.db.budget_allocation.id.delete(row.id);
		}
		// Re-insert only allocations with a positive value
		for (const { tag, allocatedCentavos } of allocations) {
			if (allocatedCentavos > 0n) {
				ctx.db.budget_allocation.insert({
					id: 0n,
					ownerIdentity,
					tag,
					allocatedCentavos,
					updatedAt: ctx.timestamp,
				});
			}
		}
	},
);

// =============================================================================
// DEBT REDUCERS
// =============================================================================

// create_debt: records a new debt. Loaned debts debit the source sub-account immediately.
// Owed debts are tracking-only (no balance impact until settled).
export const create_debt = spacetimedb.reducer(
	{
		personName: t.string(),
		direction: t.string(),
		amountCentavos: t.i64(),
		subAccountId: t.u64(),
		tag: t.string(),
		description: t.string(),
		date: t.timestamp(),
	},
	(ctx, { personName, direction, amountCentavos, subAccountId, tag, description, date }) => {
		if (!personName.trim()) throw new SenderError("Person name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (direction !== "loaned" && direction !== "owed")
			throw new SenderError("Direction must be 'loaned' or 'owed'");

		const ownerIdentity = resolveOwner(ctx);

		if (direction === "loaned") {
			// Debit source sub-account (money going out to the person)
			const source = ctx.db.sub_account.id.find(subAccountId);
			if (!source) throw new SenderError("Source sub-account not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.sub_account.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", amountCentavos),
			});

			// Create expense transaction to record the outflow
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "expense",
				amountCentavos,
				tag,
				sourceSubAccountId: subAccountId,
				destinationSubAccountId: 0n,
				serviceFeeCentavos: 0n,
				description: `Loaned to ${personName.trim()}${description ? `: ${description}` : ""}`,
				date,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		}

		ctx.db.debt.insert({
			id: 0n,
			ownerIdentity,
			personName: personName.trim(),
			direction,
			amountCentavos,
			subAccountId: direction === "loaned" ? subAccountId : 0n,
			settledAmountCentavos: 0n,
			tag,
			description: description.trim(),
			date,
			splitEventId: 0n,
			createdAt: ctx.timestamp,
		});
	},
);

// settle_debt: partially or fully settle a debt. Creates real transaction + updates settled amount.
// Loaned settlement → income (money coming back). Owed settlement → expense (you're paying them).
export const settle_debt = spacetimedb.reducer(
	{
		debtId: t.u64(),
		amountCentavos: t.i64(),
		subAccountId: t.u64(),
	},
	(ctx, { debtId, amountCentavos, subAccountId }) => {
		const existing = ctx.db.debt.id.find(debtId);
		if (!existing) throw new SenderError("Debt not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");

		const remaining = existing.amountCentavos - existing.settledAmountCentavos;
		if (amountCentavos > remaining) throw new SenderError("Amount exceeds remaining balance");

		const ownerIdentity = resolveOwner(ctx);
		const subAccountRow = ctx.db.sub_account.id.find(subAccountId);
		if (!subAccountRow) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, subAccountRow.ownerIdentity)) throw new SenderError("Not authorized");

		if (existing.direction === "loaned") {
			// Money coming back to you → income transaction, credit the sub-account
			ctx.db.sub_account.id.update({
				...subAccountRow,
				balanceCentavos: applyBalance(subAccountRow, "credit", amountCentavos),
			});
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "income",
				amountCentavos,
				tag: existing.tag,
				sourceSubAccountId: 0n,
				destinationSubAccountId: subAccountId,
				serviceFeeCentavos: 0n,
				description: `Settlement from ${existing.personName}`,
				date: ctx.timestamp,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		} else {
			// You're paying them → expense transaction, debit the sub-account
			ctx.db.sub_account.id.update({
				...subAccountRow,
				balanceCentavos: applyBalance(subAccountRow, "debit", amountCentavos),
			});
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "expense",
				amountCentavos,
				tag: existing.tag,
				sourceSubAccountId: subAccountId,
				destinationSubAccountId: 0n,
				serviceFeeCentavos: 0n,
				description: `Settlement to ${existing.personName}`,
				date: ctx.timestamp,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		}

		ctx.db.debt.id.update({
			...existing,
			settledAmountCentavos: existing.settledAmountCentavos + amountCentavos,
		});
	},
);

// delete_debt: removes a debt record. Does NOT reverse linked transactions.
export const delete_debt = spacetimedb.reducer({ debtId: t.u64() }, (ctx, { debtId }) => {
	const existing = ctx.db.debt.id.find(debtId);
	if (!existing) throw new SenderError("Debt not found");
	if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
	ctx.db.debt.id.delete(debtId);
});

// =============================================================================
// SPLIT REDUCERS
// =============================================================================

// create_split: records a shared expense. Creates expense transaction for full amount,
// then one loaned debt + participant row per person using client-computed shares.
// splitMethod: "equal" | "exact" | "percentage" | "shares"
// participantNames[i] + participantShares[i] + participantShareCounts[i] correspond to the same participant.
export const create_split = spacetimedb.reducer(
	{
		description: t.string(),
		totalAmountCentavos: t.i64(),
		payerSubAccountId: t.u64(),
		tag: t.string(),
		date: t.timestamp(),
		splitMethod: t.string(),
		participantNames: t.array(t.string()),
		participantShares: t.array(t.i64()),
		participantShareCounts: t.array(t.u32()),
	},
	(
		ctx,
		{
			description,
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			splitMethod,
			participantNames,
			participantShares,
			participantShareCounts,
		},
	) => {
		if (!description.trim()) throw new SenderError("Description is required");
		if (totalAmountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (participantNames.length === 0)
			throw new SenderError("At least one participant is required");
		if (
			participantNames.length !== participantShares.length ||
			participantNames.length !== participantShareCounts.length
		)
			throw new SenderError("Participant arrays must have the same length");

		const ownerIdentity = resolveOwner(ctx);

		// Validate and debit payer sub-account (full amount)
		const payerSubAccount = ctx.db.sub_account.id.find(payerSubAccountId);
		if (!payerSubAccount) throw new SenderError("Payer sub-account not found");
		if (!isAuthorized(ctx, payerSubAccount.ownerIdentity))
			throw new SenderError("Not authorized");
		ctx.db.sub_account.id.update({
			...payerSubAccount,
			balanceCentavos: applyBalance(payerSubAccount, "debit", totalAmountCentavos),
		});

		// Create expense transaction for the full bill
		ctx.db.transaction.insert({
			id: 0n,
			ownerIdentity,
			type: "expense",
			amountCentavos: totalAmountCentavos,
			tag,
			sourceSubAccountId: payerSubAccountId,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: `Split: ${description.trim()}`,
			date,
			createdAt: ctx.timestamp,
			isRecurring: false,
			recurringDefinitionId: 0n,
		});

		// Insert split_event
		const splitRow = ctx.db.split_event.insert({
			id: 0n,
			ownerIdentity,
			description: description.trim(),
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			createdAt: ctx.timestamp,
			splitMethod,
		});

		// Create one loaned debt + participant row per person using provided shares
		for (let i = 0; i < participantNames.length; i++) {
			const trimmedName = participantNames[i].trim();
			if (!trimmedName) continue;
			const shareAmount = participantShares[i];
			const shareCount = participantShareCounts[i];

			const debtRow = ctx.db.debt.insert({
				id: 0n,
				ownerIdentity,
				personName: trimmedName,
				direction: "loaned",
				amountCentavos: shareAmount,
				subAccountId: payerSubAccountId,
				settledAmountCentavos: 0n,
				tag,
				description: description.trim(),
				date,
				splitEventId: splitRow.id,
				createdAt: ctx.timestamp,
			});

			ctx.db.split_participant.insert({
				id: 0n,
				ownerIdentity,
				splitEventId: splitRow.id,
				personName: trimmedName,
				shareAmountCentavos: shareAmount,
				debtId: debtRow.id,
				shareCount,
			});
		}
	},
);

// delete_split: removes split_event and participants. Linked debts remain as independent records.
export const delete_split = spacetimedb.reducer(
	{ splitEventId: t.u64() },
	(ctx, { splitEventId }) => {
		const existing = ctx.db.split_event.id.find(splitEventId);
		if (!existing) throw new SenderError("Split not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// Delete all participant rows for this split
		for (const p of ctx.db.split_participant.split_participant_event.filter(splitEventId)) {
			ctx.db.split_participant.id.delete(p.id);
		}

		ctx.db.split_event.id.delete(splitEventId);
	},
);

// edit_split: updates split metadata and reconciles participants.
// If totalAmountCentavos changed, reverses old balance and applies new balance.
// participantIds[i] = 0n → new participant; >0n → update existing split_participant.id.
// Participants absent from participantIds are removed (split_participant + linked debt deleted).
// settledAmountCentavos is never touched — preserved on existing debts.
export const edit_split = spacetimedb.reducer(
	{
		splitEventId: t.u64(),
		description: t.string(),
		totalAmountCentavos: t.i64(),
		payerSubAccountId: t.u64(),
		tag: t.string(),
		date: t.timestamp(),
		splitMethod: t.string(),
		participantIds: t.array(t.u64()),
		participantNames: t.array(t.string()),
		participantShares: t.array(t.i64()),
		participantShareCounts: t.array(t.u32()),
	},
	(
		ctx,
		{
			splitEventId,
			description,
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			splitMethod,
			participantIds,
			participantNames,
			participantShares,
			participantShareCounts,
		},
	) => {
		const existing = ctx.db.split_event.id.find(splitEventId);
		if (!existing) throw new SenderError("Split not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (!description.trim()) throw new SenderError("Description is required");
		if (totalAmountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (
			participantIds.length !== participantNames.length ||
			participantIds.length !== participantShares.length ||
			participantIds.length !== participantShareCounts.length
		)
			throw new SenderError("Participant arrays must have the same length");

		const ownerIdentity = resolveOwner(ctx);

		// --- Balance correction if total changed ---
		if (totalAmountCentavos !== existing.totalAmountCentavos) {
			const payerSubAccount = ctx.db.sub_account.id.find(existing.payerSubAccountId);
			if (!payerSubAccount) throw new SenderError("Payer sub-account not found");
			if (!isAuthorized(ctx, payerSubAccount.ownerIdentity))
				throw new SenderError("Not authorized");

			// Reverse old debit
			const afterReversal = applyBalance(payerSubAccount, "credit", existing.totalAmountCentavos);
			// Apply new debit
			const afterNew = (() => {
				const updated = { ...payerSubAccount, balanceCentavos: afterReversal };
				return applyBalance(updated, "debit", totalAmountCentavos);
			})();
			ctx.db.sub_account.id.update({
				...payerSubAccount,
				balanceCentavos: afterNew,
			});
		}

		// --- Update split_event ---
		ctx.db.split_event.id.update({
			...existing,
			description: description.trim(),
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			splitMethod,
		});

		// --- Build lookup set of participant IDs to keep ---
		const keepIds = new Set(participantIds.filter((id) => id !== 0n));

		// --- Remove participants not in the new list ---
		for (const p of ctx.db.split_participant.split_participant_event.filter(splitEventId)) {
			if (!keepIds.has(p.id)) {
				ctx.db.split_participant.id.delete(p.id);
				ctx.db.debt.id.delete(p.debtId);
			}
		}

		// --- Update existing + insert new participants ---
		for (let i = 0; i < participantIds.length; i++) {
			const pid = participantIds[i];
			const trimmedName = participantNames[i].trim();
			if (!trimmedName) continue;
			const shareAmount = participantShares[i];
			const shareCount = participantShareCounts[i];

			if (pid === 0n) {
				// New participant
				const debtRow = ctx.db.debt.insert({
					id: 0n,
					ownerIdentity,
					personName: trimmedName,
					direction: "loaned",
					amountCentavos: shareAmount,
					subAccountId: payerSubAccountId,
					settledAmountCentavos: 0n,
					tag,
					description: description.trim(),
					date,
					splitEventId,
					createdAt: ctx.timestamp,
				});
				ctx.db.split_participant.insert({
					id: 0n,
					ownerIdentity,
					splitEventId,
					personName: trimmedName,
					shareAmountCentavos: shareAmount,
					debtId: debtRow.id,
					shareCount,
				});
			} else {
				// Update existing participant
				const existingP = ctx.db.split_participant.id.find(pid);
				if (!existingP) continue;
				ctx.db.split_participant.id.update({
					...existingP,
					personName: trimmedName,
					shareAmountCentavos: shareAmount,
					shareCount,
				});
				// Update the linked debt amount (preserve settledAmountCentavos)
				const existingDebt = ctx.db.debt.id.find(existingP.debtId);
				if (existingDebt) {
					ctx.db.debt.id.update({
						...existingDebt,
						personName: trimmedName,
						amountCentavos: shareAmount,
						tag,
						description: description.trim(),
					});
				}
			}
		}
	},
);

// =============================================================================
// TAG CONFIG REDUCERS
// =============================================================================

export const add_custom_tag = spacetimedb.reducer(
	{
		transactionType: t.string(),
		tag: t.string(),
	},
	(ctx, { transactionType, tag }) => {
		const normalizedTag = normalizeTagName(tag);
		if (!normalizedTag) throw new SenderError("Tag name is required");
		if (DEFAULT_TAGS_BY_TYPE[transactionType]?.includes(normalizedTag)) {
			throw new SenderError("Tag already exists for this type");
		}
		const ownerIdentity = resolveOwner(ctx);
		for (const config of ctx.db.user_tag_config.tag_config_owner.filter(ownerIdentity)) {
			if (config.transactionType === transactionType && config.tag === normalizedTag) {
				throw new SenderError("Tag already exists for this type");
			}
		}
		ctx.db.user_tag_config.insert({
			id: 0n,
			ownerIdentity,
			transactionType,
			tag: normalizedTag,
			isCustom: true,
			isHidden: false,
		});
	},
);

export const delete_custom_tag = spacetimedb.reducer(
	{ tagConfigId: t.u64() },
	(ctx, { tagConfigId }) => {
		const existing = ctx.db.user_tag_config.id.find(tagConfigId);
		if (!existing) throw new SenderError("Tag config not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		if (!existing.isCustom) {
			throw new SenderError("Cannot delete default tags");
		}
		ctx.db.user_tag_config.id.delete(tagConfigId);
	},
);

export const toggle_tag_visibility = spacetimedb.reducer(
	{
		transactionType: t.string(),
		tag: t.string(),
	},
	(ctx, { transactionType, tag }) => {
		const ownerIdentity = resolveOwner(ctx);
		const found =
			[...ctx.db.user_tag_config.tag_config_owner.filter(ownerIdentity)].find(
				(config) => config.transactionType === transactionType && config.tag === tag,
			) ?? null;
		if (found) {
			ctx.db.user_tag_config.id.update({
				...found,
				isHidden: !found.isHidden,
			});
		} else {
			ctx.db.user_tag_config.insert({
				id: 0n,
				ownerIdentity,
				transactionType,
				tag,
				isCustom: false,
				isHidden: true,
			});
		}
	},
);

// Seed the daily TD maturity check schedule the first time any client connects.
// check_td_maturity re-schedules itself on each fire, so we only need to seed once.
spacetimedb.clientConnected((ctx) => {
	for (const _ of ctx.db.td_maturity_schedule.iter()) {
		return; // schedule already exists — nothing to do
	}
	const oneDayMicros = 86_400n * 1_000_000n;
	ctx.db.td_maturity_schedule.insert({
		scheduledId: 0n,
		scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + oneDayMicros),
	});
});
