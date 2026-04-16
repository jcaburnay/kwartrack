import { t } from "spacetimedb/server";
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
