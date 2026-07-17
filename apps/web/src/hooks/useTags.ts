import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import { createSharedStore, registerSharedStore } from "./sharedStore";

export type Tag = Database["public"]["Tables"]["tag"]["Row"];
export type TagScope = Database["public"]["Enums"]["tag_type"];

const store = createSharedStore<Tag[]>(async () => {
	const { data, error } = await supabase.from("tag").select("*").order("name", { ascending: true });
	if (error) throw new Error(error.message);
	return data ?? [];
}, []);

registerSharedStore(store.reset);

export function useTags() {
	const { data, isLoading, error, refetch } = store.useStore();

	const createInline = useCallback(
		async (name: string, type: Exclude<TagScope, "any">): Promise<Tag | null> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return null;
			const { data: created, error: insErr } = await supabase
				.from("tag")
				.insert({
					user_id: userData.user.id,
					name: name.trim(),
					type,
					is_system: false,
				})
				.select()
				.single();
			if (insErr || !created) return null;
			await refetch();
			return created;
		},
		[refetch],
	);

	const renameTag = useCallback(
		async (id: string, newName: string): Promise<string | null> => {
			const { error: updErr } = await supabase
				.from("tag")
				.update({ name: newName.trim() })
				.eq("id", id);
			if (updErr) return updErr.message;
			await refetch();
			return null;
		},
		[refetch],
	);

	const deleteTag = useCallback(
		async (id: string): Promise<{ error: string | null }> => {
			// Pre-check transaction + recurring + split + debt references for a
			// friendly count. budget_allocation is intentionally excluded:
			// ON DELETE CASCADE on tag_id silently drops allocations.
			const [txRes, recRes, splitRes, debtRes] = await Promise.all([
				supabase.from("transaction").select("id", { count: "exact", head: true }).eq("tag_id", id),
				supabase.from("recurring").select("id", { count: "exact", head: true }).eq("tag_id", id),
				supabase.from("split_event").select("id", { count: "exact", head: true }).eq("tag_id", id),
				supabase.from("debt").select("id", { count: "exact", head: true }).eq("tag_id", id),
			]);
			if (txRes.error) return { error: txRes.error.message };
			if (recRes.error) return { error: recRes.error.message };
			if (splitRes.error) return { error: splitRes.error.message };
			if (debtRes.error) return { error: debtRes.error.message };
			const counts = [
				{ n: txRes.count ?? 0, label: "transaction" },
				{ n: recRes.count ?? 0, label: "recurring" },
				{ n: splitRes.count ?? 0, label: "split" },
				{ n: debtRes.count ?? 0, label: "debt" },
			];
			for (const c of counts) {
				if (c.n > 0) {
					return {
						error: `This tag is used by ${c.n} ${c.label}${c.n === 1 ? "" : "s"} and cannot be deleted.`,
					};
				}
			}
			const { error: delErr } = await supabase.from("tag").delete().eq("id", id);
			if (delErr) return { error: delErr.message };
			await refetch();
			return { error: null };
		},
		[refetch],
	);

	return { tags: data, isLoading, error, refetch, createInline, renameTag, deleteTag };
}
