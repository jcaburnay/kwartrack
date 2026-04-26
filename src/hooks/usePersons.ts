import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";

export type Person = Database["public"]["Tables"]["person"]["Row"];

type State = {
	persons: Person[];
	isLoading: boolean;
	error: string | null;
};

export function usePersons() {
	const [state, setState] = useState<State>({
		persons: [],
		isLoading: true,
		error: null,
	});

	const refetch = useCallback(async () => {
		const { data, error } = await supabase
			.from("person")
			.select("*")
			.order("name", { ascending: true });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({ persons: data ?? [], isLoading: false, error: null });
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	const createInline = useCallback(
		async (name: string): Promise<Person | null> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return null;
			const { data, error } = await supabase
				.from("person")
				.insert({ user_id: userData.user.id, name: name.trim() })
				.select()
				.single();
			if (error || !data) return null;
			await refetch();
			return data;
		},
		[refetch],
	);

	const renamePerson = useCallback(
		async (id: string, name: string): Promise<string | null> => {
			const { error } = await supabase.from("person").update({ name: name.trim() }).eq("id", id);
			if (error) return error.message;
			await refetch();
			return null;
		},
		[refetch],
	);

	const deletePerson = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			// Pre-check FK references to give a friendly count.
			const [debtRes, partRes] = await Promise.all([
				supabase.from("debt").select("id", { count: "exact", head: true }).eq("person_id", id),
				supabase
					.from("split_participant")
					.select("id", { count: "exact", head: true })
					.eq("person_id", id),
			]);
			if (debtRes.error) return { error: debtRes.error.message };
			if (partRes.error) return { error: partRes.error.message };
			const dCount = debtRes.count ?? 0;
			const pCount = partRes.count ?? 0;
			if (dCount > 0 || pCount > 0) {
				const parts: string[] = [];
				if (pCount > 0) parts.push(`${pCount} split${pCount === 1 ? "" : "s"}`);
				if (dCount > 0) parts.push(`${dCount} debt${dCount === 1 ? "" : "s"}`);
				return {
					error: `This person is referenced by ${parts.join(" and ")} — remove or reassign them first.`,
				};
			}
			const { error } = await supabase.from("person").delete().eq("id", id);
			if (error) return { error: error.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	return { ...state, refetch, createInline, renamePerson, deletePerson };
}
