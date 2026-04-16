import { ScheduleAt } from "spacetimedb";
import spacetimedb from "./schema";

// Seed the daily TD maturity check schedule the first time any client connects.
// check_td_maturity re-schedules itself on each fire, so we only need to seed once.
// NOTE: clientConnected must be exported to be registered by SpacetimeDB.
export const on_connect = spacetimedb.clientConnected((ctx) => {
	for (const _ of ctx.db.td_maturity_schedule.iter()) {
		return; // schedule already exists — nothing to do
	}
	const oneDayMicros = 86_400n * 1_000_000n;
	ctx.db.td_maturity_schedule.insert({
		scheduledId: 0n,
		scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + oneDayMicros),
	});
});
