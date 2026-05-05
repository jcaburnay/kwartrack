import { useState } from "react";
import { NewPersonModal } from "../components/debts/NewPersonModal";
import { type Person, usePersons } from "../hooks/usePersons";

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
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-lg font-semibold">Contacts</h2>
				<button type="button" className="btn btn-cta btn-sm" onClick={() => setCreating(true)}>
					New person
				</button>
			</div>
			<p className="text-sm text-base-content/60">
				Contacts are people referenced by your splits and debts.
			</p>
			{error && <div className="alert alert-error text-sm">{error}</div>}
			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : persons.length === 0 ? (
				<p className="text-sm text-base-content/60">
					No contacts yet. Add people to attach them to splits and IOUs.
				</p>
			) : (
				<ul className="divide-y divide-base-300 rounded-box border border-base-300">
					{persons.map((p) => (
						<li key={p.id} className="flex items-center justify-between gap-3 p-3">
							{editingId === p.id ? (
								<div className="flex gap-2 flex-1">
									<input
										type="text"
										className="input input-bordered input-sm flex-1"
										value={editingName}
										onChange={(e) => setEditingName(e.target.value)}
									/>
									<button
										type="button"
										className="btn btn-sm btn-cta"
										onClick={() => handleRename(p.id)}
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
									<p className="font-medium">{p.name}</p>
									<div className="flex gap-2">
										<button
											type="button"
											className="btn btn-xs btn-ghost"
											onClick={() => {
												setEditingId(p.id);
												setEditingName(p.name);
											}}
										>
											Rename
										</button>
										<button
											type="button"
											className="btn btn-xs btn-ghost text-error"
											onClick={() => handleDelete(p)}
										>
											Delete
										</button>
									</div>
								</>
							)}
						</li>
					))}
				</ul>
			)}
			{creating && (
				<NewPersonModal
					create={createInline}
					onCreated={() => setCreating(false)}
					onCancel={() => setCreating(false)}
				/>
			)}
		</div>
	);
}
