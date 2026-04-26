import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";

export type Tag = Database["public"]["Tables"]["tag"]["Row"];
export type TagScope = Database["public"]["Enums"]["tag_type"];

type State = {
	tags: Tag[];
	isLoading: boolean;
	error: string | null;
};

export function useTags() {
	const [state, setState] = useState<State>({ tags: [], isLoading: true, error: null });

	const refetch = useCallback(async () => {
		const { data, error } = await supabase
			.from("tag")
			.select("*")
			.order("name", { ascending: true });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({ tags: data ?? [], isLoading: false, error: null });
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	const createInline = useCallback(
		async (name: string, type: Exclude<TagScope, "any">): Promise<Tag | null> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return null;
			const { data, error } = await supabase
				.from("tag")
				.insert({
					user_id: userData.user.id,
					name: name.trim(),
					type,
					is_system: false,
				})
				.select()
				.single();
			if (error || !data) return null;
			await refetch();
			return data;
		},
		[refetch],
	);

	const renameTag = useCallback(
		async (id: string, newName: string): Promise<string | null> => {
			const { error } = await supabase.from("tag").update({ name: newName.trim() }).eq("id", id);
			if (error) return error.message;
			await refetch();
			return null;
		},
		[refetch],
	);

	const deleteTag = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			// Check transaction + recurring usage before attempting delete.
			// Allocations are intentionally excluded: budget_allocation.tag_id has
			// ON DELETE CASCADE, so deleting a tag silently removes its allocations.
			// TODO: When split and debt tables are added in later slices, extend
			// this count to include those tables too.
			const [txRes, recRes] = await Promise.all([
				supabase.from("transaction").select("id", { count: "exact", head: true }).eq("tag_id", id),
				supabase.from("recurring").select("id", { count: "exact", head: true }).eq("tag_id", id),
			]);
			if (txRes.error) return { error: txRes.error.message };
			if (recRes.error) return { error: recRes.error.message };
			const txCount = txRes.count ?? 0;
			const recCount = recRes.count ?? 0;
			if (txCount > 0) {
				return {
					error: `This tag is used by ${txCount} transaction${txCount === 1 ? "" : "s"} and cannot be deleted.`,
				};
			}
			if (recCount > 0) {
				return {
					error: `This tag is used by ${recCount} recurring${recCount === 1 ? "" : "s"} and cannot be deleted.`,
				};
			}
			const { error } = await supabase.from("tag").delete().eq("id", id);
			if (error) return { error: error.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	return { ...state, refetch, createInline, renameTag, deleteTag };
}
