import { ScheduleAt } from "spacetimedb";
import { schema, t, table } from "spacetimedb/server";

// user_profile: maps Clerk identity to SpacetimeDB identity — unchanged from Phase 1
const userProfile = table(
	{ name: "user_profile", public: true },
	{
		identity: t.identity().primaryKey(),
		clerkUserId: t.string().unique(),
		displayName: t.string(),
		createdAt: t.timestamp(),
	},
);

// account: top-level financial container (Maya, GCash, RCBC, BPI, etc.)
// No public:true — all data access via my_accounts view (D-09)
// isStandalone: true = hidden default sub-account holds the initial balance (D-04, D-06)
// isStandalone: false = has sub-accounts, balance = sum of visible sub-account balanceCentavos
// accessor: the property name used in code (e.g. ctx.db.account.account_owner.filter(...))
export const account = table(
	{
		name: "account",
		indexes: [
			{
				accessor: "account_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		name: t.string(),
		isStandalone: t.bool(),
		createdAt: t.timestamp(),
		iconBankId: t.string().optional().default(undefined),
	},
);

// sub_account: sub-bucket within an account (renamed from partition)
// isDefault: true = hidden sub-account created by create_account for standalone accounts (D-04)
// isDefault: true sub-accounts are NEVER shown in the UI
// No public:true — all data access via my_sub_accounts view (D-09)
export const sub_account = table(
	{
		name: "sub_account",
		indexes: [
			{
				accessor: "sub_account_account",
				algorithm: "btree",
				columns: ["accountId"],
			},
			{
				accessor: "sub_account_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		accountId: t.u64(),
		ownerIdentity: t.identity(),
		name: t.string(),
		balanceCentavos: t.i64(),
		isDefault: t.bool(),
		createdAt: t.timestamp(),
		subAccountType: t.string(), // 'wallet' | 'savings' | 'time-deposit' | 'credit'
		creditLimitCentavos: t.i64(), // 0n for non-credit; monthly limit for credit
	},
);

// identity_alias: maps every STDB identity to a canonical primary identity (D-09 multi-device)
// Each Clerk user has ONE primary identity (first device to connect).
// All other devices/browsers register as aliases pointing to the primary.
// Views always filter by primary identity, so all sessions share the same data.
export const identity_alias = table(
	{ name: "identity_alias" },
	{
		stdbIdentity: t.identity().primaryKey(),
		primaryIdentity: t.identity(),
		clerkUserId: t.string(),
	},
);

// transaction: Full D-20 schema — private table, access via my_transactions view
// D-23 indexes: transaction_owner, transaction_source, transaction_destination
export const transaction = table(
	{
		name: "transaction",
		indexes: [
			{
				accessor: "transaction_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
			{
				accessor: "transaction_source",
				algorithm: "btree",
				columns: ["sourceSubAccountId"],
			},
			{
				accessor: "transaction_destination",
				algorithm: "btree",
				columns: ["destinationSubAccountId"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		type: t.string(), // "expense" | "income" | "transfer"
		amountCentavos: t.i64(),
		tag: t.string(),
		sourceSubAccountId: t.u64(), // 0n for income
		destinationSubAccountId: t.u64(), // 0n for expense
		serviceFeeCentavos: t.i64(), // 0n if not a transfer
		description: t.string(), // empty string if none
		date: t.timestamp(), // user-specified date, not server time
		createdAt: t.timestamp(),
		isRecurring: t.bool(), // D-10: true if auto-created by scheduler
		recurringDefinitionId: t.u64(), // D-10: 0n if not recurring
	},
);

// recurring_transaction_definition: stores monthly recurring transaction templates
// No public:true — all data access via my_recurring_definitions view (D-16)
// Index recurring_owner on ownerIdentity for my_recurring_definitions view (D-13)
export const recurring_transaction_definition = table(
	{
		name: "recurring_transaction_definition",
		indexes: [
			{
				accessor: "recurring_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		name: t.string(),
		type: t.string(), // "expense" | "income"
		amountCentavos: t.i64(),
		tag: t.string(),
		subAccountId: t.u64(), // source for expense, destination for income
		dayOfMonth: t.u8(), // 1–28 (D-05)
		isPaused: t.bool(),
		remainingMonths: t.u16(), // countdown; 0 = indefinite (per D-10)
		totalMonths: t.u16(), // original installment length; 0 = indefinite (per D-10)
		createdAt: t.timestamp(),
	},
);

// recurring_transaction_schedule: SpacetimeDB scheduled table (D-14)
// One row per active recurring definition; SpacetimeDB auto-deletes the row after reducer fires.
// `scheduled: () => fire_recurring_transaction` — thunk forward ref resolved at module-eval time.
// TypeScript cannot infer the circular type, so we use `as any` to break the type cycle.
// Both table and reducer must be in the same file to avoid circular imports (schema.ts ← index.ts).
export const recurring_transaction_schedule = table(
	{
		name: "recurring_transaction_schedule",
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		// biome-ignore lint/suspicious/noExplicitAny: SpacetimeDB scheduled thunk — forward ref to fire_recurring_transaction resolved at runtime
		scheduled: (() => fire_recurring_transaction) as any,
		indexes: [
			{
				accessor: "recurring_schedule_definition_id",
				algorithm: "btree",
				columns: ["definitionId"],
			},
		],
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
		definitionId: t.u64(),
	},
);

export const budget_config = table(
	{
		name: "budget_config",
		indexes: [
			{
				accessor: "budget_config_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		totalCentavos: t.i64(),
		updatedAt: t.timestamp(),
	},
);

export const budget_allocation = table(
	{
		name: "budget_allocation",
		indexes: [
			{
				accessor: "budget_allocation_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
			// NOTE: Multi-column index declared for documentation only.
			// DO NOT call .filter() on budget_allocation_owner_tag — CAUSES PANIC.
			// See server/CLAUDE.md: multi-column index filter is broken in SpacetimeDB TypeScript SDK.
			{
				accessor: "budget_allocation_owner_tag",
				algorithm: "btree",
				columns: ["ownerIdentity", "tag"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		tag: t.string(),
		allocatedCentavos: t.i64(),
		updatedAt: t.timestamp(),
	},
);

// debt: tracks money lent to or owed by other people
// direction="loaned": user lent money (sub-account debited at creation)
// direction="owed": user owes money (tracking only, no balance impact until settled)
// splitEventId=0 means manual debt; >0 links to a split_event
export const debt = table(
	{
		name: "debt",
		indexes: [
			{
				accessor: "debt_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		personName: t.string(),
		direction: t.string(), // "loaned" | "owed"
		amountCentavos: t.i64(),
		subAccountId: t.u64(), // source sub-account (loaned) or 0n (owed)
		settledAmountCentavos: t.i64(), // running total of settlements
		tag: t.string(),
		description: t.string(),
		date: t.timestamp(),
		splitEventId: t.u64(), // 0 = manual, >0 = from split
		createdAt: t.timestamp(),
	},
);

// split_event: a shared expense that generates one loaned debt per participant
export const split_event = table(
	{
		name: "split_event",
		indexes: [
			{
				accessor: "split_event_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		description: t.string(),
		totalAmountCentavos: t.i64(),
		payerSubAccountId: t.u64(),
		tag: t.string(),
		date: t.timestamp(),
		createdAt: t.timestamp(),
	},
);

// split_participant: links a split_event to participant debts
export const split_participant = table(
	{
		name: "split_participant",
		indexes: [
			{
				accessor: "split_participant_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
			{
				accessor: "split_participant_event",
				algorithm: "btree",
				columns: ["splitEventId"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		splitEventId: t.u64(),
		personName: t.string(),
		shareAmountCentavos: t.i64(),
		debtId: t.u64(),
	},
);

// user_tag_config: per-user tag visibility and custom tags
export const user_tag_config = table(
	{
		name: "user_tag_config",
		indexes: [
			{
				accessor: "tag_config_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		id: t.u64().primaryKey().autoInc(),
		ownerIdentity: t.identity(),
		transactionType: t.string(),
		tag: t.string(),
		isCustom: t.bool(),
		isHidden: t.bool(),
	},
);

const spacetimedb = schema({
	userProfile,
	identity_alias,
	account,
	sub_account,
	transaction,
	recurring_transaction_definition,
	recurring_transaction_schedule,
	budget_config,
	budget_allocation,
	debt,
	split_event,
	split_participant,
	user_tag_config,
});
export default spacetimedb;

// Compute the microsecond timestamp for the same dayOfMonth in the NEXT calendar month.
// Uses Date arithmetic from a deterministic ctx.timestamp input — acceptable per RESEARCH.md Pattern 2.
// NEVER call this with dayOfMonth > 28; definition creation enforces the 1–28 cap (D-05).
export function computeNextMonthMicros(nowMicros: bigint, dayOfMonth: number): bigint {
	const nowMs = Number(nowMicros / 1000n);
	const now = new Date(nowMs);
	let targetYear = now.getUTCFullYear();
	let targetMonth = now.getUTCMonth() + 1; // advance one month
	if (targetMonth > 11) {
		targetMonth = 0;
		targetYear += 1;
	}
	const fireDate = new Date(Date.UTC(targetYear, targetMonth, dayOfMonth, 0, 0, 0, 0));
	return BigInt(fireDate.getTime()) * 1000n;
}

// fire_recurring_transaction: scheduled reducer that fires when scheduledAt arrives (D-15)
// SpacetimeDB auto-deletes the schedule row after this reducer completes.
// Defined after spacetimedb to avoid TDZ; thunk in recurring_transaction_schedule resolves at runtime.
export const fire_recurring_transaction = spacetimedb.reducer(
	{ arg: recurring_transaction_schedule.rowType },
	(ctx, { arg }) => {
		const def = ctx.db.recurring_transaction_definition.id.find(arg.definitionId);
		// Definition deleted or paused — do not create transaction
		if (!def || def.isPaused) return;

		// Create transaction record (isRecurring: true per D-15, D-10)
		ctx.db.transaction.insert({
			id: 0n,
			ownerIdentity: def.ownerIdentity,
			type: def.type,
			amountCentavos: def.amountCentavos,
			tag: def.tag,
			sourceSubAccountId: def.type === "expense" ? def.subAccountId : 0n,
			destinationSubAccountId: def.type === "income" ? def.subAccountId : 0n,
			serviceFeeCentavos: 0n,
			description: `Recurring: ${def.name}`,
			date: ctx.timestamp,
			createdAt: ctx.timestamp,
			isRecurring: true,
			recurringDefinitionId: def.id,
		});

		// Update sub-account balance (credit-aware: expense on credit sub-account INCREASES balance)
		const subAccount = ctx.db.sub_account.id.find(def.subAccountId);
		if (subAccount) {
			if (def.type === "expense") {
				const isCreditSubAccount = subAccount.subAccountType === "credit";
				ctx.db.sub_account.id.update({
					...subAccount,
					balanceCentavos: isCreditSubAccount
						? subAccount.balanceCentavos + def.amountCentavos
						: subAccount.balanceCentavos - def.amountCentavos,
				});
			} else if (def.type === "income") {
				ctx.db.sub_account.id.update({
					...subAccount,
					balanceCentavos: subAccount.balanceCentavos + def.amountCentavos,
				});
			}
		}

		// Installment countdown: decrement remainingMonths and auto-pause at 0 (D-01)
		if (def.remainingMonths > 0) {
			const newRemaining = def.remainingMonths - 1;
			if (newRemaining === 0) {
				// Auto-pause: set isPaused=true, update remainingMonths to 0, do NOT schedule next fire
				ctx.db.recurring_transaction_definition.id.update({
					...def,
					remainingMonths: 0,
					isPaused: true,
				});
				return; // Early return — no next schedule (per D-01)
			}
			// Decrement and continue to schedule next fire
			ctx.db.recurring_transaction_definition.id.update({
				...def,
				remainingMonths: newRemaining,
			});
		}

		// Schedule next month's fire (D-15)
		const nextFireMicros = computeNextMonthMicros(
			ctx.timestamp.microsSinceUnixEpoch,
			def.dayOfMonth,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextFireMicros),
			definitionId: def.id,
		});
	},
);
