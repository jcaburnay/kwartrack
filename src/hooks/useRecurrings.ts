import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { Recurring } from "../utils/recurringFilters";
import type { RecurringInput } from "../utils/recurringValidation";

type RecurringInsert = Database["public"]["Tables"]["recurring"]["Insert"];
type RecurringUpdate = Database["public"]["Tables"]["recurring"]["Update"];

type State = {
	recurrings: Recurring[];
	isLoading: boolean;
	error: string | null;
};

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

export function useRecurrings() {
	const [state, setState] = useState<State>({
		recurrings: [],
		isLoading: true,
		error: null,
	});

	const refetch = useCallback(async () => {
		const { data, error } = await supabase
			.from("recurring")
			.select("*")
			.order("is_completed", { ascending: true })
			.order("is_paused", { ascending: true })
			.order("next_occurrence_at", { ascending: true });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({ recurrings: data ?? [], isLoading: false, error: null });
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	const createRecurring = useCallback(
		async (input: RecurringInput): Promise<{ error: string | null }> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return { error: "Not signed in" };
			const { error } = await supabase
				.from("recurring")
				.insert(inputToInsert(input, userData.user.id));
			if (error) return { error: error.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const updateRecurring = useCallback(
		async (id: string, partial: RecurringUpdate): Promise<{ error: string | null }> => {
			const { error } = await supabase.from("recurring").update(partial).eq("id", id);
			if (error) return { error: error.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const deleteRecurring = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			const { error } = await supabase.from("recurring").delete().eq("id", id);
			if (error) return { error: error.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	const togglePaused = useCallback(
		async (id: string, currentlyPaused: boolean): Promise<{ error: string | null }> => {
			// The BEFORE trigger handles next_at recompute on resume.
			const { error } = await supabase
				.from("recurring")
				.update({ is_paused: !currentlyPaused })
				.eq("id", id);
			if (error) return { error: error.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	return { ...state, refetch, createRecurring, updateRecurring, deleteRecurring, togglePaused };
}
