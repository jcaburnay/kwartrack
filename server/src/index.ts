import { ScheduleAt } from "spacetimedb";
import { type InferSchema, type ReducerCtx, SenderError, t } from "spacetimedb/server";
import spacetimedb, {
	account,
	budget_allocation,
	budget_config,
	debt,
	partition,
	recurring_transaction_definition,
	split_event,
	split_participant,
	transaction,
	user_tag_config,
} from "./schema";

// Re-export the schema as the default export — required by spacetime CLI bundler
// Also re-export fire_recurring_transaction so SpacetimeDB can resolve the scheduled reducer
export { default, fire_recurring_transaction } from "./schema";

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

// applyBalance: applies a debit or credit direction to a partition's balanceCentavos.
// Credit partitions use inverted semantics (D-01): expense INCREASES outstanding (0=clean, positive=owed).
// direction "debit" = take money out (expense/transfer-from); "credit" = put money in (income/transfer-to).
// delta is always positive.
function applyBalance(
	partition: { balanceCentavos: bigint; partitionType: string },
	direction: "debit" | "credit",
	delta: bigint,
): bigint {
	const isCreditPartition = partition.partitionType === "credit";
	if (direction === "debit") {
		// Non-credit: balance goes down. Credit: outstanding goes up.
		return isCreditPartition
			? partition.balanceCentavos + delta
			: partition.balanceCentavos - delta;
	} else {
		// Non-credit: balance goes up. Credit: outstanding goes down (payment).
		return isCreditPartition
			? partition.balanceCentavos - delta
			: partition.balanceCentavos + delta;
	}
}

// =============================================================================
// VIEWS — data privacy per D-09
// Client subscribes via: 'SELECT * FROM my_accounts', 'SELECT * FROM my_partitions'
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

export const my_partitions = spacetimedb.view(
	{ name: "my_partitions", public: true },
	t.array(partition.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.partition.partition_owner.filter(ownerIdentity)];
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

// my_recurring_definitions: filtered view of recurring_transaction_definition for the calling user (D-16, D-17)
// Client subscribes via: 'SELECT * FROM my_recurring_definitions'
export const my_recurring_definitions = spacetimedb.view(
	{ name: "my_recurring_definitions", public: true },
	t.array(recurring_transaction_definition.rowType),
	(ctx) => {
		const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		const ownerIdentity = alias?.primaryIdentity ?? ctx.sender;
		return [...ctx.db.recurring_transaction_definition.recurring_owner.filter(ownerIdentity)];
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
		sourcePartitionId: t.u64(),
		destinationPartitionId: t.u64(),
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
			sourcePartitionId,
			destinationPartitionId,
			serviceFeeCentavos,
			description,
			date,
		},
	) => {
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (!tag.trim()) throw new SenderError("Tag is required");

		const ownerIdentity = resolveOwner(ctx);

		// Validate and update source partition (expense, transfer)
		if (type === "expense" || type === "transfer") {
			const source = ctx.db.partition.id.find(sourcePartitionId);
			if (!source) throw new SenderError("Source partition not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			const debit = amountCentavos + serviceFeeCentavos;
			ctx.db.partition.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", debit),
			});
		}

		// Validate and update destination partition (income, transfer)
		if (type === "income" || type === "transfer") {
			const destination = ctx.db.partition.id.find(destinationPartitionId);
			if (!destination) throw new SenderError("Destination partition not found");
			if (!isAuthorized(ctx, destination.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.partition.id.update({
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
			sourcePartitionId,
			destinationPartitionId,
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
		sourcePartitionId: t.u64(),
		destinationPartitionId: t.u64(),
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
			sourcePartitionId,
			destinationPartitionId,
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
			const oldSource = ctx.db.partition.id.find(existing.sourcePartitionId);
			if (oldSource) {
				const oldDebit = existing.amountCentavos + existing.serviceFeeCentavos;
				ctx.db.partition.id.update({
					...oldSource,
					balanceCentavos: applyBalance(oldSource, "credit", oldDebit), // reversal = opposite direction
				});
			}
		}
		if (existing.type === "income" || existing.type === "transfer") {
			const oldDest = ctx.db.partition.id.find(existing.destinationPartitionId);
			if (oldDest) {
				ctx.db.partition.id.update({
					...oldDest,
					balanceCentavos: applyBalance(oldDest, "debit", existing.amountCentavos), // reversal = opposite direction
				});
			}
		}

		// --- Apply new transaction's balance effect ---
		if (type === "expense" || type === "transfer") {
			const source = ctx.db.partition.id.find(sourcePartitionId);
			if (!source) throw new SenderError("Source partition not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			const debit = amountCentavos + serviceFeeCentavos;
			ctx.db.partition.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", debit),
			});
		}
		if (type === "income" || type === "transfer") {
			const dest = ctx.db.partition.id.find(destinationPartitionId);
			if (!dest) throw new SenderError("Destination partition not found");
			if (!isAuthorized(ctx, dest.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.partition.id.update({
				...dest,
				balanceCentavos: applyBalance(dest, "credit", amountCentavos),
			});
		}

		ctx.db.transaction.id.update({
			...existing,
			type,
			amountCentavos,
			tag,
			sourcePartitionId,
			destinationPartitionId,
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
			const source = ctx.db.partition.id.find(existing.sourcePartitionId);
			if (source) {
				const debit = existing.amountCentavos + existing.serviceFeeCentavos;
				ctx.db.partition.id.update({
					...source,
					balanceCentavos: applyBalance(source, "credit", debit), // undo the debit
				});
			}
		}
		if (existing.type === "income" || existing.type === "transfer") {
			const dest = ctx.db.partition.id.find(existing.destinationPartitionId);
			if (dest) {
				ctx.db.partition.id.update({
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
// If initialBalanceCentavos > 0n => isStandalone=true, hidden default partition auto-created (D-04)
// If initialBalanceCentavos === 0n => isStandalone=false, no partitions created
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
			// Hidden default partition stores the initial balance (D-04)
			ctx.db.partition.insert({
				id: 0n,
				accountId: accountRow.id,
				ownerIdentity,
				name: "__default__",
				balanceCentavos: initialBalanceCentavos,
				isDefault: true,
				createdAt: ctx.timestamp,
				partitionType: "wallet",
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
// Cascades: deletes all partitions (including hidden default partition) first (D-15)
export const delete_account = spacetimedb.reducer({ accountId: t.u64() }, (ctx, { accountId }) => {
	const existing = ctx.db.account.id.find(accountId);
	if (!existing) throw new SenderError("Account not found");
	if (!isAuthorized(ctx, existing.ownerIdentity)) {
		throw new SenderError("Not authorized");
	}
	for (const p of ctx.db.partition.partition_account.filter(accountId)) {
		ctx.db.partition.id.delete(p.id);
	}
	ctx.db.account.id.delete(accountId);
});

// =============================================================================
// PARTITION REDUCERS
// =============================================================================

// add_partition
// Client: conn.reducers.addPartition({ accountId: 1n, name: 'Ewallet', initialBalanceCentavos: 0n, partitionType: 'wallet', creditLimitCentavos: 0n })
// Handles standalone->partitioned conversion (D-08)
export const add_partition = spacetimedb.reducer(
	{
		accountId: t.u64(),
		name: t.string(),
		initialBalanceCentavos: t.i64(),
		partitionType: t.string(), // new: 'wallet' | 'savings' | 'time-deposit' | 'credit'
		creditLimitCentavos: t.i64(), // new: 0n for non-credit
	},
	(ctx, { accountId, name, initialBalanceCentavos, partitionType, creditLimitCentavos }) => {
		if (!name.trim()) throw new SenderError("Partition name is required");
		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}

		const ownerIdentity = resolveOwner(ctx);

		if (acc.isStandalone) {
			// Standalone->partitioned conversion (D-08): delete hidden default partition
			for (const p of ctx.db.partition.partition_account.filter(accountId)) {
				if (p.isDefault) ctx.db.partition.id.delete(p.id);
			}
			ctx.db.account.id.update({ ...acc, isStandalone: false });
		}

		ctx.db.partition.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: name.trim(),
			balanceCentavos: initialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			partitionType: partitionType || "wallet",
			creditLimitCentavos: creditLimitCentavos ?? 0n,
		});
	},
);

// rename_partition
// Client: conn.reducers.renamePartition({ partitionId: 3n, newName: 'Savings' })
export const rename_partition = spacetimedb.reducer(
	{ partitionId: t.u64(), newName: t.string() },
	(ctx, { partitionId, newName }) => {
		if (!newName.trim()) throw new SenderError("Partition name is required");
		const existing = ctx.db.partition.id.find(partitionId);
		if (!existing) throw new SenderError("Partition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		ctx.db.partition.id.update({ ...existing, name: newName.trim() });
	},
);

// edit_partition — update name and credit limit for credit partitions
// Client: conn.reducers.editPartition({ partitionId: 1n, newName: 'RCBC Credit', newCreditLimitCentavos: 15000000n })
export const edit_partition = spacetimedb.reducer(
	{
		partitionId: t.u64(),
		newName: t.string(),
		newCreditLimitCentavos: t.i64(),
	},
	(ctx, { partitionId, newName, newCreditLimitCentavos }) => {
		if (!newName.trim()) throw new SenderError("Partition name is required");
		if (newCreditLimitCentavos <= 0n) throw new SenderError("Credit limit must be greater than 0");
		const existing = ctx.db.partition.id.find(partitionId);
		if (!existing) throw new SenderError("Partition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		if (existing.partitionType !== "credit") {
			throw new SenderError("Only credit partitions can be edited");
		}
		ctx.db.partition.id.update({
			...existing,
			name: newName.trim(),
			creditLimitCentavos: newCreditLimitCentavos,
		});
	},
);

// delete_partition
// Client: conn.reducers.deletePartition({ partitionId: 3n })
export const delete_partition = spacetimedb.reducer(
	{ partitionId: t.u64() },
	(ctx, { partitionId }) => {
		const existing = ctx.db.partition.id.find(partitionId);
		if (!existing) throw new SenderError("Partition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		ctx.db.partition.id.delete(partitionId);
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
// Five CRUD reducers for recurring_transaction_definition (RECR-01, RECR-03)
// =============================================================================

// Compute the first fire timestamp for a new definition (D-06):
// If dayOfMonth >= today's day → fire this month (day hasn't passed yet).
// If dayOfMonth < today's day → fire next month.
function computeFirstFireMicros(nowMicros: bigint, dayOfMonth: number): bigint {
	const nowMs = Number(nowMicros / 1000n);
	const now = new Date(nowMs);
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
// Client: conn.reducers.createRecurringDefinition({ name, type, amountCentavos, tag, partitionId, dayOfMonth })
export const create_recurring_definition = spacetimedb.reducer(
	{
		name: t.string(),
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		partitionId: t.u64(),
		dayOfMonth: t.u8(),
		remainingMonths: t.u16(),
		totalMonths: t.u16(),
	},
	(
		ctx,
		{ name, type, amountCentavos, tag, partitionId, dayOfMonth, remainingMonths, totalMonths },
	) => {
		if (!name.trim()) throw new SenderError("Name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (dayOfMonth < 1 || dayOfMonth > 28) throw new SenderError("Day must be 1–28");

		const ownerIdentity = resolveOwner(ctx);

		const defRow = ctx.db.recurring_transaction_definition.insert({
			id: 0n,
			ownerIdentity,
			name: name.trim(),
			type,
			amountCentavos,
			tag,
			partitionId,
			dayOfMonth,
			isPaused: false,
			remainingMonths,
			totalMonths,
			createdAt: ctx.timestamp,
		});

		// Schedule the first fire (D-06)
		const firstFireMicros = computeFirstFireMicros(ctx.timestamp.microsSinceUnixEpoch, dayOfMonth);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(firstFireMicros),
			definitionId: defRow.id,
		});
	},
);

// edit_recurring_definition
// Client: conn.reducers.editRecurringDefinition({ definitionId, name, type, amountCentavos, tag, partitionId, dayOfMonth })
export const edit_recurring_definition = spacetimedb.reducer(
	{
		definitionId: t.u64(),
		name: t.string(),
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		partitionId: t.u64(),
		dayOfMonth: t.u8(),
		remainingMonths: t.u16(),
	},
	(
		ctx,
		{ definitionId, name, type, amountCentavos, tag, partitionId, dayOfMonth, remainingMonths },
	) => {
		const existing = ctx.db.recurring_transaction_definition.id.find(definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (!name.trim()) throw new SenderError("Name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (dayOfMonth < 1 || dayOfMonth > 28) throw new SenderError("Day must be 1–28");

		ctx.db.recurring_transaction_definition.id.update({
			...existing,
			name: name.trim(),
			type,
			amountCentavos,
			tag,
			partitionId,
			dayOfMonth,
			remainingMonths,
		});
	},
);

// delete_recurring_definition
// Client: conn.reducers.deleteRecurringDefinition({ definitionId })
export const delete_recurring_definition = spacetimedb.reducer(
	{ definitionId: t.u64() },
	(ctx, { definitionId }) => {
		const existing = ctx.db.recurring_transaction_definition.id.find(definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// Delete associated schedule row(s) if any (D-07)
		for (const schedRow of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
			definitionId,
		)) {
			ctx.db.recurring_transaction_schedule.scheduledId.delete(schedRow.scheduledId);
		}

		ctx.db.recurring_transaction_definition.id.delete(definitionId);
	},
);

// pause_recurring_definition
// Client: conn.reducers.pauseRecurringDefinition({ definitionId })
// D-07: Pausing deletes the schedule row and sets isPaused: true
export const pause_recurring_definition = spacetimedb.reducer(
	{ definitionId: t.u64() },
	(ctx, { definitionId }) => {
		const existing = ctx.db.recurring_transaction_definition.id.find(definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (existing.isPaused) return; // already paused, no-op

		// Delete schedule row (D-07)
		for (const schedRow of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
			definitionId,
		)) {
			ctx.db.recurring_transaction_schedule.scheduledId.delete(schedRow.scheduledId);
		}

		ctx.db.recurring_transaction_definition.id.update({ ...existing, isPaused: true });
	},
);

// resume_recurring_definition
// Client: conn.reducers.resumeRecurringDefinition({ definitionId })
// D-07: Resuming inserts a new schedule row for the next upcoming fire date and clears isPaused
export const resume_recurring_definition = spacetimedb.reducer(
	{ definitionId: t.u64() },
	(ctx, { definitionId }) => {
		const existing = ctx.db.recurring_transaction_definition.id.find(definitionId);
		if (!existing) throw new SenderError("Definition not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (!existing.isPaused) return; // already active, no-op

		// Insert new schedule row for next upcoming fire date
		const nextFireMicros = computeFirstFireMicros(
			ctx.timestamp.microsSinceUnixEpoch,
			existing.dayOfMonth,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextFireMicros),
			definitionId: existing.id,
		});

		ctx.db.recurring_transaction_definition.id.update({ ...existing, isPaused: false });
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

// create_debt: records a new debt. Loaned debts debit the source partition immediately.
// Owed debts are tracking-only (no balance impact until settled).
export const create_debt = spacetimedb.reducer(
	{
		personName: t.string(),
		direction: t.string(),
		amountCentavos: t.i64(),
		partitionId: t.u64(),
		tag: t.string(),
		description: t.string(),
		date: t.timestamp(),
	},
	(ctx, { personName, direction, amountCentavos, partitionId, tag, description, date }) => {
		if (!personName.trim()) throw new SenderError("Person name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (direction !== "loaned" && direction !== "owed")
			throw new SenderError("Direction must be 'loaned' or 'owed'");

		const ownerIdentity = resolveOwner(ctx);

		if (direction === "loaned") {
			// Debit source partition (money going out to the person)
			const source = ctx.db.partition.id.find(partitionId);
			if (!source) throw new SenderError("Source partition not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.partition.id.update({
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
				sourcePartitionId: partitionId,
				destinationPartitionId: 0n,
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
			partitionId: direction === "loaned" ? partitionId : 0n,
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
		partitionId: t.u64(),
	},
	(ctx, { debtId, amountCentavos, partitionId }) => {
		const existing = ctx.db.debt.id.find(debtId);
		if (!existing) throw new SenderError("Debt not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");

		const remaining = existing.amountCentavos - existing.settledAmountCentavos;
		if (amountCentavos > remaining) throw new SenderError("Amount exceeds remaining balance");

		const ownerIdentity = resolveOwner(ctx);
		const partitionRow = ctx.db.partition.id.find(partitionId);
		if (!partitionRow) throw new SenderError("Partition not found");
		if (!isAuthorized(ctx, partitionRow.ownerIdentity)) throw new SenderError("Not authorized");

		if (existing.direction === "loaned") {
			// Money coming back to you → income transaction, credit the partition
			ctx.db.partition.id.update({
				...partitionRow,
				balanceCentavos: applyBalance(partitionRow, "credit", amountCentavos),
			});
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "income",
				amountCentavos,
				tag: existing.tag,
				sourcePartitionId: 0n,
				destinationPartitionId: partitionId,
				serviceFeeCentavos: 0n,
				description: `Settlement from ${existing.personName}`,
				date: ctx.timestamp,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		} else {
			// You're paying them → expense transaction, debit the partition
			ctx.db.partition.id.update({
				...partitionRow,
				balanceCentavos: applyBalance(partitionRow, "debit", amountCentavos),
			});
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "expense",
				amountCentavos,
				tag: existing.tag,
				sourcePartitionId: partitionId,
				destinationPartitionId: 0n,
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
// then one loaned debt per participant with equal shares.
export const create_split = spacetimedb.reducer(
	{
		description: t.string(),
		totalAmountCentavos: t.i64(),
		payerPartitionId: t.u64(),
		tag: t.string(),
		date: t.timestamp(),
		participantNames: t.array(t.string()),
	},
	(ctx, { description, totalAmountCentavos, payerPartitionId, tag, date, participantNames }) => {
		if (!description.trim()) throw new SenderError("Description is required");
		if (totalAmountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (participantNames.length === 0)
			throw new SenderError("At least one participant is required");

		const ownerIdentity = resolveOwner(ctx);

		// Validate and debit payer partition (full amount)
		const payerPartition = ctx.db.partition.id.find(payerPartitionId);
		if (!payerPartition) throw new SenderError("Payer partition not found");
		if (!isAuthorized(ctx, payerPartition.ownerIdentity)) throw new SenderError("Not authorized");
		ctx.db.partition.id.update({
			...payerPartition,
			balanceCentavos: applyBalance(payerPartition, "debit", totalAmountCentavos),
		});

		// Create expense transaction for the full bill
		ctx.db.transaction.insert({
			id: 0n,
			ownerIdentity,
			type: "expense",
			amountCentavos: totalAmountCentavos,
			tag,
			sourcePartitionId: payerPartitionId,
			destinationPartitionId: 0n,
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
			payerPartitionId,
			tag,
			date,
			createdAt: ctx.timestamp,
		});

		// Equal split: total ÷ (participants + you)
		const splitCount = BigInt(participantNames.length + 1);
		const shareAmount = totalAmountCentavos / splitCount;

		// Create one loaned debt + participant row per person
		for (const name of participantNames) {
			const trimmedName = name.trim();
			if (!trimmedName) continue;

			const debtRow = ctx.db.debt.insert({
				id: 0n,
				ownerIdentity,
				personName: trimmedName,
				direction: "loaned",
				amountCentavos: shareAmount,
				partitionId: payerPartitionId,
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
