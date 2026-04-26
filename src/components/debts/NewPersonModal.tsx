import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { Person } from "../../hooks/usePersons";
import { validatePerson } from "../../utils/personValidation";

type Props = {
	initialName?: string;
	create: (name: string) => Promise<Person | null>;
	onCreated: (person: Person) => void;
	onCancel: () => void;
};

export function NewPersonModal({ initialName, create, onCreated, onCancel }: Props) {
	const [name, setName] = useState(initialName ?? "");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		e.stopPropagation();
		const v = validatePerson(name);
		if (!v.ok) return setError(v.message);
		setError(null);
		setIsSubmitting(true);
		const created = await create(name);
		setIsSubmitting(false);
		if (!created) return setError("Could not create person.");
		onCreated(created);
	}

	// Portal to document.body so the inner <form> isn't nested inside an outer
	// modal's <form> (e.g. NewSplitModal opens this via PersonPicker). Slice 2
	// memory note "modal-inside-form" — same fix.
	return createPortal(
		<div className="modal modal-open" role="dialog" aria-modal="true">
			<div className="modal-box max-w-sm">
				<h3 className="font-semibold text-lg mb-3">New person</h3>
				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<label className="form-control">
						<div className="label">
							<span className="label-text">Name</span>
						</div>
						<input
							autoFocus
							type="text"
							className="input input-bordered"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</label>
					{error && <div className="alert alert-error text-sm">{error}</div>}
					<div className="modal-action">
						<button type="button" className="btn btn-ghost" onClick={onCancel}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
							{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
						</button>
					</div>
				</form>
			</div>
			<button type="button" className="modal-backdrop" onClick={onCancel} aria-label="Dismiss" />
		</div>,
		document.body,
	);
}
