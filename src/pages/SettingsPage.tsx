import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTagActions, useTags } from "../hooks";
import { DEFAULT_TAGS } from "../utils/tagConfig";

const TYPES = ["expense", "income", "transfer"] as const;

export function SettingsPage() {
	const { tagConfigs, isLoading: isTagConfigsReady } = useTags();
	const {
		addCustom: addCustomTag,
		removeCustom: deleteCustomTag,
		toggleVisibility: toggleTagVisibility,
	} = useTagActions();

	const [activeTab, setActiveTab] = useState<string>("expense");
	const [newTagInput, setNewTagInput] = useState("");

	if (!isTagConfigsReady) return null;

	const typeConfigs = tagConfigs.filter((c) => c.transactionType === activeTab);
	const defaultTags = DEFAULT_TAGS[activeTab] ?? [];
	const customTags = typeConfigs.filter((c) => c.isCustom);

	const isTagHidden = (tag: string) => {
		const config = typeConfigs.find((c) => c.tag === tag);
		return config?.isHidden ?? false;
	};

	const handleToggle = (tag: string) => {
		toggleTagVisibility({ transactionType: activeTab, tag });
	};

	const handleAddTag = () => {
		const tag = newTagInput.trim().toLowerCase().replace(/\s+/g, "-");
		if (!tag) return;
		const allTagsForType = [...(DEFAULT_TAGS[activeTab] ?? []), ...customTags.map((c) => c.tag)];
		if (allTagsForType.includes(tag)) return;
		addCustomTag({ transactionType: activeTab, tag });
		setNewTagInput("");
	};

	const handleDeleteCustomTag = (configId: bigint) => {
		deleteCustomTag({ tagConfigId: configId });
	};

	return (
		<div className="p-4 sm:p-6 ">
			<h1 className="text-xs font-medium tracking-widest text-base-content/60 uppercase mb-5">
				Settings
			</h1>

			{/* Tags section */}
			<div className="rounded-xl border border-base-300/50 bg-base-100 shadow-sm">
				<div className="px-4 py-3 border-b border-base-300/50">
					<h3 className="text-sm font-semibold">Tags</h3>
					<p className="text-xs text-base-content/60 mt-0.5">
						Manage tags for each transaction type. Toggle visibility or add custom tags.
					</p>
				</div>

				{/* Tabs */}
				<div className="flex border-b border-base-300/50">
					{TYPES.map((type) => (
						<button
							key={type}
							type="button"
							className={`flex-1 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
								activeTab === type
									? "border-b-2 border-primary text-primary"
									: "text-base-content/60 hover:text-base-content"
							}`}
							onClick={() => {
								setActiveTab(type);
								setNewTagInput("");
							}}
						>
							{type}
						</button>
					))}
				</div>

				<div className="p-4">
					{/* Default tags */}
					{defaultTags.length > 0 && (
						<div className="mb-4">
							<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-2">
								Default tags
							</h2>
							<div className="flex flex-col gap-1">
								{defaultTags.map((tag) => (
									<div
										key={tag}
										className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-base-200/50"
									>
										<span className="text-sm capitalize">{tag.replace(/-/g, " ")}</span>
										<input
											type="checkbox"
											className="toggle toggle-sm toggle-primary"
											checked={!isTagHidden(tag)}
											onChange={() => handleToggle(tag)}
										/>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Custom tags */}
					{customTags.length > 0 && (
						<div className="mb-4">
							<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-2">
								Custom tags
							</h2>
							<div className="flex flex-col gap-1">
								{customTags.map((config) => (
									<div
										key={config.id.toString()}
										className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-base-200/50"
									>
										<span className="text-sm capitalize">{config.tag.replace(/-/g, " ")}</span>
										<div className="flex items-center gap-2">
											<input
												type="checkbox"
												className="toggle toggle-sm toggle-primary"
												checked={!config.isHidden}
												onChange={() => handleToggle(config.tag)}
											/>
											<button
												type="button"
												className="btn btn-ghost btn-xs btn-circle text-error"
												onClick={() => handleDeleteCustomTag(config.id)}
												aria-label={`Delete ${config.tag}`}
											>
												<Trash2 size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Add tag */}
					<div className="flex gap-2">
						<input
							type="text"
							className="input input-bordered input-sm flex-1"
							placeholder="New tag name"
							value={newTagInput}
							maxLength={50}
							onChange={(e) => setNewTagInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleAddTag();
							}}
						/>
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={handleAddTag}
							disabled={!newTagInput.trim()}
						>
							<Plus size={14} />
							Add
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
