import { ScheduleAt } from "spacetimedb";
import { SenderError, t } from "spacetimedb/server";
import { type AppCtx, computeFirstFireMicros, isAuthorized, resolveOwner } from "../helpers";
import spacetimedb from "../schema";

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
