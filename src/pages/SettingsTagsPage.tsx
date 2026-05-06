import { Lock } from "lucide-react";
import { useState } from "react";
import { CreateTagModal } from "../components/tags/CreateTagModal";
import type { Tag } from "../hooks/useTags";
import { useTags } from "../hooks/useTags";

type Bucket = {
	label: string;
	tags: Tag[];
};

export function SettingsTagsPage() {
	const { tags, isLoading, renameTag, deleteTag, createInline } = useTags();
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [error, setError] = useState<string | null>(null);

	// Tags are already sorted alphabetically by useTags (ORDER BY name).
	// Partition into display buckets; empty buckets are suppressed.
	const buckets: Bucket[] = [
		{ label: "Expense", tags: tags.filter((t) => t.type === "expense" && !t.is_system) },
		{ label: "Income", tags: tags.filter((t) => t.type === "income" && !t.is_system) },
		{ label: "Transfer", tags: tags.filter((t) => t.type === "transfer" && !t.is_system) },
		{ label: "System", tags: tags.filter((t) => t.is_system) },
	].filter((b) => b.tags.length > 0);

	async function handleRename(id: string) {
		setError(null);
		const err = await renameTag(id, editingName);
		if (err) return setError(err);
		setEditingId(null);
		setEditingName("");
	}

	async function handleDelete(tag: Tag) {
		setError(null);
		if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
		const { error: err } = await deleteTag(tag.id);
		if (err) setError(err);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-lg font-semibold">Tags</h2>
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
					Create tag
				</button>
			</div>
			<p className="text-sm text-base-content/60">
				Tags categorise your transactions. System tags are reserved and cannot be renamed or
				deleted.
			</p>

			{error && <div className="alert alert-error text-sm">{error}</div>}

			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : buckets.length === 0 ? (
				<p className="text-sm text-base-content/60">
					No tags yet. Create one to categorize transactions.
				</p>
			) : (
				<div className="flex flex-col gap-4">
					{buckets.map((bucket) => (
						<div key={bucket.label} className="flex flex-col gap-1">
							<h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide">
								{bucket.label}
							</h3>
							<ul className="divide-y divide-base-300 rounded-box border border-base-300">
								{bucket.tags.map((tag) => (
									<li key={tag.id} className="flex items-center justify-between gap-3 p-3">
										{editingId === tag.id ? (
											<div className="flex gap-2 flex-1">
												<input
													type="text"
													className="input input-bordered input-sm flex-1"
													value={editingName}
													onChange={(e) => setEditingName(e.target.value)}
												/>
												<button
													type="button"
													className="btn btn-sm btn-primary"
													onClick={() => handleRename(tag.id)}
												>
													Save
												</button>
												<button
													type="button"
													className="btn btn-sm btn-ghost"
													onClick={() => {
														setEditingId(null);
														setEditingName("");
													}}
												>
													Cancel
												</button>
											</div>
										) : (
											<>
												<div className="flex items-center gap-2">
													{tag.is_system && (
														<Lock
															className="w-3.5 h-3.5 text-base-content/40"
															aria-label="System tag"
														/>
													)}
													<p className="font-medium">{tag.name}</p>
												</div>
												{!tag.is_system && (
													<div className="flex gap-2">
														<button
															type="button"
															className="btn btn-xs btn-ghost touch-target"
															onClick={() => {
																setEditingId(tag.id);
																setEditingName(tag.name);
															}}
														>
															Rename
														</button>
														<button
															type="button"
															className="btn btn-xs btn-ghost text-error touch-target"
															onClick={() => handleDelete(tag)}
														>
															Delete
														</button>
													</div>
												)}
											</>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}

			{creating && (
				<CreateTagModal
					create={createInline}
					onCreated={() => setCreating(false)}
					onCancel={() => setCreating(false)}
				/>
			)}
		</div>
	);
}
