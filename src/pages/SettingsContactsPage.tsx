import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { NewPersonModal } from "../components/debts/NewPersonModal";
import { SettingsSection } from "../components/settings/SettingsSection";
import { type Person, usePersons } from "../hooks/usePersons";
import { initialsFrom } from "../utils/initials";

export function SettingsContactsPage() {
	const { persons, isLoading, renamePerson, deletePerson, createInline } = usePersons();
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [error, setError] = useState<string | null>(null);

	async function handleRename(id: string) {
		setError(null);
		const err = await renamePerson(id, editingName);
		if (err) return setError(err);
		setEditingId(null);
		setEditingName("");
	}

	async function handleDelete(p: Person) {
		setError(null);
		if (!window.confirm(`Delete contact "${p.name}"?`)) return;
		const { error: err } = await deletePerson(p.id);
		if (err) setError(err);
	}

	return (
		<SettingsSection
			title="Contacts"
			description="People referenced by your splits and debts. Delete is blocked if a contact has linked records."
			action={
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
					New person
				</button>
			}
		>
			{error && <div className="alert alert-error text-sm">{error}</div>}

			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : persons.length === 0 ? (
				<div className="border border-dashed border-base-300 rounded-box p-8 text-center text-sm text-base-content/60">
					No contacts yet. Add people to attach them to splits and IOUs.
				</div>
			) : (
				<ul className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100">
					{persons.map((p) => {
						const isEditing = editingId === p.id;
						return (
							<li key={p.id} className="flex items-center gap-3 px-4 py-2.5 min-h-[3.25rem]">
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
											onClick={() => handleRename(p.id)}
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
										<div className="avatar avatar-placeholder shrink-0">
											<div className="bg-base-200 text-base-content/70 w-8 rounded-full">
												<span className="text-xs font-medium">{initialsFrom(p.name)}</span>
											</div>
										</div>
										<p className="text-sm flex-1 truncate">{p.name}</p>
										<div className="flex gap-1 shrink-0">
											<button
												type="button"
												aria-label={`Rename ${p.name}`}
												className="btn btn-xs btn-ghost btn-square touch-target"
												onClick={() => {
													setEditingId(p.id);
													setEditingName(p.name);
												}}
											>
												<Pencil className="size-3.5" />
											</button>
											<button
												type="button"
												aria-label={`Delete ${p.name}`}
												className="btn btn-xs btn-ghost btn-square text-error touch-target"
												onClick={() => handleDelete(p)}
											>
												<Trash2 className="size-3.5" />
											</button>
										</div>
									</>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{creating && (
				<NewPersonModal
					create={createInline}
					onCreated={() => setCreating(false)}
					onCancel={() => setCreating(false)}
				/>
			)}
		</SettingsSection>
	);
}
