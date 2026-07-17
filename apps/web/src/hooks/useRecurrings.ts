import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { Recurring } from "../utils/recurringFilters";
import type { RecurringInput } from "../utils/recurringValidation";
import { createSharedStore, registerSharedStore } from "./sharedStore";

type RecurringInsert = Database["public"]["Tables"]["recurring"]["Insert"];
type RecurringUpdate = Database["public"]["Tables"]["recurring"]["Update"];

function inputToInsert(input: RecurringInput, userId: string): RecurringInsert {
	// next_occurrence_at is set by the BEFORE trigger; we send a placeholder
	// (now) since the column is non-null. The trigger overwrites it.
	const now = new Date().toISOString();
	return {
		user_id: userId,
		service: input.service.trim(),
		amount_centavos: input.amountCentavos,
		type: input.type,
		tag_id: input.tagId,
		from_account_id: input.fromAccountId,
		to_account_id: input.toAccountId,
		fee_centavos: input.feeCentavos,
		description: input.description.trim() || null,
		interval: input.interval,
		first_occurrence_date: input.firstOccurrenceDate,
		next_occurrence_at: now,
		remaining_occurrences: input.remainingOccurrences,
	};
}

const store = createSharedStore<Recurring[]>(async () => {
	const { data, error } = await supabase
		.from("recurring")
		.select("*")
		.order("is_completed", { ascending: true })
		.order("is_paused", { ascending: true })
		.order("next_occurrence_at", { ascending: true });
	if (error) throw new Error(error.message);
	return data ?? [];
}, []);

registerSharedStore(store.reset);

export function useRecurrings() {
	const { data, isLoading, error, refetch } = store.useStore();

	const createRecurring = useCallback(
		async (input: RecurringInput): Promise<{ error: string | null }> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return { error: "Not signed in" };
			const { error: insErr } = await supabase
				.from("recurring")
				.insert(inputToInsert(input, userData.user.id));
			if (insErr) return { error: insErr.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const updateRecurring = useCallback(
		async (id: string, partial: RecurringUpdate): Promise<{ error: string | null }> => {
			const { error: updErr } = await supabase.from("recurring").update(partial).eq("id", id);
			if (updErr) return { error: updErr.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const deleteRecurring = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			const { error: delErr } = await supabase.from("recurring").delete().eq("id", id);
			if (delErr) return { error: delErr.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const togglePaused = useCallback(
		async (id: string, currentlyPaused: boolean): Promise<{ error: string | null }> => {
			// The BEFORE trigger handles next_at recompute on resume.
			const { error: updErr } = await supabase
				.from("recurring")
				.update({ is_paused: !currentlyPaused })
				.eq("id", id);
			if (updErr) return { error: updErr.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	return {
		recurrings: data,
		isLoading,
		error,
		refetch,
		createRecurring,
		updateRecurring,
		deleteRecurring,
		togglePaused,
	};
}
