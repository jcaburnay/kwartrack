import { t } from "spacetimedb/server";
import { resolveOwner } from "../helpers";
import spacetimedb from "../schema";

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
