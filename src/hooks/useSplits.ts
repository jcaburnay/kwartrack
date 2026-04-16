import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useSplits() {
	const [events, isEventsLoading] = useTable(tables.my_split_events);
	const [participants, isParticipantsLoading] = useTable(tables.my_split_participants);
	return { events, participants, isEventsLoading, isParticipantsLoading };
}
