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

// recurring_transaction_definition: stores recurring transaction templates (interval-aware)
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
		dayOfMonth: t.u8(), // 1–28 (D-05); ignored for weekly/biweekly (interval anchors only first fire)
		interval: t.string(), // "weekly"|"biweekly"|"monthly"|"quarterly"|"semiannual"|"yearly"
		isPaused: t.bool(),
		remainingOccurrences: t.u16(), // countdown; 0 = indefinite (per D-10)
		totalOccurrences: t.u16(), // original installment length; 0 = indefinite (per D-10)
		createdAt: t.timestamp(),
	},
);

// recurring_transaction_definition_v2: v2 with anchorMonth + anchorDayOfWeek for full interval support
// Migration: incremental (lazy) pattern — v1 rows are migrated to v2 on first access.
// See migrateV1RowToV2() in index.ts. No manual migration call needed after deploy.
// Index name recurring_owner_v2 avoids collision with recurring_owner on v1.
export const recurring_transaction_definition_v2 = table(
	{
		name: "recurring_transaction_definition_v2",
		indexes: [
			{
				accessor: "recurring_owner_v2",
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
		subAccountId: t.u64(),
		dayOfMonth: t.u8(), // 1–28; used for month-based intervals; placeholder 1 for weekly/biweekly
		interval: t.string(), // "weekly"|"biweekly"|"monthly"|"quarterly"|"semiannual"|"yearly"
		anchorMonth: t.u8(), // 0 = default; 1–12 = anchor month for semiannual/yearly
		anchorDayOfWeek: t.u8(), // 0 = default; 1=Mon..7=Sun for weekly/biweekly
		isPaused: t.bool(),
		remainingOccurrences: t.u16(), // 0 = indefinite
		totalOccurrences: t.u16(), // 0 = indefinite
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

// time_deposit_metadata: stores TD-specific metadata, linked to sub_account and recurring definition
// Private table — accessed via my_time_deposit_metadata view (index on ownerIdentity)
export const time_deposit_metadata = table(
	{
		name: "time_deposit_metadata",
		indexes: [
			{
				accessor: "td_metadata_owner",
				algorithm: "btree",
				columns: ["ownerIdentity"],
			},
		],
	},
	{
		subAccountId: t.u64().primaryKey(), // FK to sub_account; 1:1 relationship
		ownerIdentity: t.identity(),
		interestRateBps: t.u32(), // basis points: 600 = 6.00% p.a.
		maturityDate: t.timestamp(), // when interest stops and isMatured is set
		recurringDefinitionId: t.u64(), // FK to recurring_transaction_definition_v2
		isMatured: t.bool(),
		createdAt: t.timestamp(),
	},
);

// td_maturity_schedule: daily scheduled table to detect matured time deposits
// scheduled: () => check_td_maturity — thunk resolved at runtime (same pattern as recurring_transaction_schedule)
export const td_maturity_schedule = table(
	{
		name: "td_maturity_schedule",
		// biome-ignore lint/suspicious/noExplicitAny: SpacetimeDB scheduled thunk — forward ref to check_td_maturity resolved at runtime
		scheduled: (() => check_td_maturity) as any,
	},
	{
		scheduledId: t.u64().primaryKey().autoInc(),
		scheduledAt: t.scheduleAt(),
	},
);

const spacetimedb = schema({
	userProfile,
	identity_alias,
	account,
	sub_account,
	transaction,
	recurring_transaction_definition,
	recurring_transaction_definition_v2,
	recurring_transaction_schedule,
	budget_config,
	budget_allocation,
	debt,
	split_event,
	split_participant,
	user_tag_config,
	time_deposit_metadata,
	td_maturity_schedule,
});
export default spacetimedb;

// Compute the microsecond timestamp for the next occurrence based on the interval.
// For weekly/biweekly: adds 7 or 14 days to nowMicros (dayOfMonth anchors only first fire).
// For month-based intervals: advances by N months and pins to dayOfMonth.
// NEVER call with dayOfMonth > 28; enforced at creation time (D-05).
export function computeNextOccurrence(
	nowMicros: bigint,
	interval: string,
	dayOfMonth: number,
): bigint {
	if (interval === "weekly") {
		return nowMicros + 7n * 24n * 60n * 60n * 1_000_000n;
	}
	if (interval === "biweekly") {
		return nowMicros + 14n * 24n * 60n * 60n * 1_000_000n;
	}
	const monthsToAdd =
		interval === "monthly"
			? 1
			: interval === "quarterly"
				? 3
				: interval === "semiannual"
					? 6
					: interval === "yearly"
						? 12
						: (() => {
								throw new Error(`Unknown interval: ${interval}`);
							})();
	const nowMs = Number(nowMicros / 1000n);
	const now = new Date(nowMs);
	let targetYear = now.getUTCFullYear();
	let targetMonth = now.getUTCMonth() + monthsToAdd;
	while (targetMonth > 11) {
		targetMonth -= 12;
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
		// Incremental migration: check v2 first; if missing, migrate from v1 on the spot.
		// NOTE: this duplicates migrateV1RowToV2() in index.ts (schema.ts can't import from index.ts).
		// If the migration shape changes (field list, defaults), update BOTH places.
		let def = ctx.db.recurring_transaction_definition_v2.id.find(arg.definitionId);
		if (!def) {
			const v1 = ctx.db.recurring_transaction_definition.id.find(arg.definitionId);
			if (!v1) return;
			def = ctx.db.recurring_transaction_definition_v2.insert({
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

		// Installment countdown: decrement remainingOccurrences and auto-pause at 0 (D-01)
		if (def.remainingOccurrences > 0) {
			const newRemaining = def.remainingOccurrences - 1;
			if (newRemaining === 0) {
				// Auto-pause: set isPaused=true, update remainingOccurrences to 0, do NOT schedule next fire
				ctx.db.recurring_transaction_definition_v2.id.update({
					...def,
					remainingOccurrences: 0,
					isPaused: true,
				});
				return; // Early return — no next schedule (per D-01)
			}
			// Decrement and continue to schedule next fire
			ctx.db.recurring_transaction_definition_v2.id.update({
				...def,
				remainingOccurrences: newRemaining,
			});
		}

		// Schedule next fire based on interval (D-15)
		const nextFireMicros = computeNextOccurrence(
			ctx.timestamp.microsSinceUnixEpoch,
			def.interval,
			def.dayOfMonth,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextFireMicros),
			definitionId: def.id,
		});
	},
);

// check_td_maturity: daily scheduled reducer — pauses interest on matured TDs
// Uses .iter() because scheduled reducers run as module identity (ctx.sender ≠ any user)
export const check_td_maturity = spacetimedb.reducer(
	{ arg: td_maturity_schedule.rowType },
	(ctx, _) => {
		const nowMicros = ctx.timestamp.microsSinceUnixEpoch;

		for (const meta of ctx.db.time_deposit_metadata.iter()) {
			if (meta.isMatured) continue;
			if (meta.maturityDate.microsSinceUnixEpoch > nowMicros) continue;

			const def = ctx.db.recurring_transaction_definition_v2.id.find(meta.recurringDefinitionId);
			if (def && !def.isPaused) {
				ctx.db.recurring_transaction_definition_v2.id.update({
					...def,
					isPaused: true,
				});
				for (const sched of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
					meta.recurringDefinitionId,
				)) {
					ctx.db.recurring_transaction_schedule.scheduledId.delete(sched.scheduledId);
				}
			}

			ctx.db.time_deposit_metadata.subAccountId.update({
				...meta,
				isMatured: true,
			});
		}

		const nextFireMicros = ctx.timestamp.microsSinceUnixEpoch + 86_400n * 1_000_000n;
		ctx.db.td_maturity_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(nextFireMicros),
		});
	},
);
