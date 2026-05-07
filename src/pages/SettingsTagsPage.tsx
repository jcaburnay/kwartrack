import { Check, ChevronDown, ChevronRight, Lock, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { SettingsSection } from "../components/settings/SettingsSection";
import { CreateTagModal } from "../components/tags/CreateTagModal";
import type { Tag } from "../hooks/useTags";
import { useTags } from "../hooks/useTags";

type BucketKey = "expense" | "income" | "transfer" | "system";

type Bucket = {
	key: BucketKey;
	label: string;
	tags: Tag[];
	dotClass: string;
};

const BUCKET_DOT: Record<BucketKey, string> = {
	expense: "bg-error",
	income: "bg-success",
	transfer: "bg-info",
	system: "bg-base-content/40",
};

export function SettingsTagsPage() {
	const { tags, isLoading, renameTag, deleteTag, createInline } = useTags();
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [folded, setFolded] = useState<Record<BucketKey, boolean>>({
		expense: false,
		income: false,
		transfer: false,
		system: false,
	});

	const buckets: Bucket[] = (
		[
			{
				key: "expense",
				label: "Expense",
				tags: tags.filter((t) => t.type === "expense" && !t.is_system),
				dotClass: BUCKET_DOT.expense,
			},
			{
				key: "income",
				label: "Income",
				tags: tags.filter((t) => t.type === "income" && !t.is_system),
				dotClass: BUCKET_DOT.income,
			},
			{
				key: "transfer",
				label: "Transfer",
				tags: tags.filter((t) => t.type === "transfer" && !t.is_system),
				dotClass: BUCKET_DOT.transfer,
			},
			{
				key: "system",
				label: "System",
				tags: tags.filter((t) => t.is_system),
				dotClass: BUCKET_DOT.system,
			},
		] as Bucket[]
	).filter((b) => b.tags.length > 0);

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
		<SettingsSection
			title="Tags"
			description="Tags categorise your transactions. System tags are reserved and cannot be renamed or deleted."
			action={
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
					Create tag
				</button>
			}
		>
			{error && <div className="alert alert-error text-sm">{error}</div>}

			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : buckets.length === 0 ? (
				<div className="border border-dashed border-base-300 rounded-box p-8 text-center text-sm text-base-content/60">
					No tags yet. Create one to categorize transactions.
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{buckets.map((bucket) => {
						const isFolded = folded[bucket.key];
						return (
							<div
								key={bucket.key}
								className="rounded-box border border-base-300 overflow-hidden bg-base-100"
							>
								<button
									type="button"
									aria-expanded={!isFolded}
									aria-label={`${isFolded ? "Expand" : "Collapse"} ${bucket.label} tags`}
									className="w-full h-10 flex items-center gap-2 px-4 hover:bg-base-200/50 transition-colors text-left"
									onClick={() => setFolded((f) => ({ ...f, [bucket.key]: !f[bucket.key] }))}
								>
									{isFolded ? (
										<ChevronRight className="size-3.5 text-base-content/40" />
									) : (
										<ChevronDown className="size-3.5 text-base-content/40" />
									)}
									<span className={`w-1.5 h-1.5 rounded-full ${bucket.dotClass}`} />
									<span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
										{bucket.label}
									</span>
									<span className="text-xs text-base-content/30">·</span>
									<span className="text-xs text-base-content/60">{bucket.tags.length}</span>
								</button>

								{!isFolded && (
									<ul className="divide-y divide-base-300 border-t border-base-300">
										{bucket.tags.map((tag) => {
											const isEditing = editingId === tag.id;
											return (
												<li
													key={tag.id}
													className="flex items-center gap-3 px-4 py-2.5 min-h-[3rem]"
												>
													{isEditing ? (
														<div className="flex gap-2 flex-1">
															<input
																type="text"
																className="input input-bordered input-sm flex-1"
																value={editingName}
																onChange={(e) => setEditingName(e.target.value)}
																autoFocus
															/>
															<button
																type="button"
																aria-label="Save"
																className="btn btn-sm btn-primary btn-square"
																onClick={() => handleRename(tag.id)}
															>
																<Check className="size-4" />
															</button>
															<button
																type="button"
																aria-label="Cancel"
																className="btn btn-sm btn-ghost btn-square"
																onClick={() => {
																	setEditingId(null);
																	setEditingName("");
																}}
															>
																<X className="size-4" />
															</button>
														</div>
													) : (
														<>
															<span
																className={`w-2 h-2 rounded-full shrink-0 ${bucket.dotClass}`}
																aria-hidden
															/>
															{tag.is_system && (
																<Lock
																	className="w-3.5 h-3.5 text-base-content/40 shrink-0"
																	aria-label="System tag"
																/>
															)}
															<p className="text-sm flex-1 truncate">{tag.name}</p>
															{!tag.is_system && (
																<div className="flex gap-1 shrink-0">
																	<button
																		type="button"
																		aria-label={`Rename ${tag.name}`}
																		className="btn btn-xs btn-ghost btn-square touch-target"
																		onClick={() => {
																			setEditingId(tag.id);
																			setEditingName(tag.name);
																		}}
																	>
																		<Pencil className="size-3.5" />
																	</button>
																	<button
																		type="button"
																		aria-label={`Delete ${tag.name}`}
																		className="btn btn-xs btn-ghost btn-square text-error touch-target"
																		onClick={() => handleDelete(tag)}
																	>
																		<Trash2 className="size-3.5" />
																	</button>
																</div>
															)}
														</>
													)}
												</li>
											);
										})}
									</ul>
								)}
							</div>
						);
					})}
				</div>
			)}

			{creating && (
				<CreateTagModal
					create={createInline}
					onCreated={() => setCreating(false)}
					onCancel={() => setCreating(false)}
				/>
			)}
		</SettingsSection>
	);
}
