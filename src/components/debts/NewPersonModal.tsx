import type React from "react";
import { useState } from "react";
import type { Person } from "../../hooks/usePersons";
import { validatePerson } from "../../utils/personValidation";
import { Modal } from "../ui/Modal";

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

	return (
		<Modal onClose={onCancel} size="sm">
			<Modal.Header title="New person" />
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<label className="floating-label">
					<span>Name</span>
					<input
						autoFocus
						type="text"
						placeholder="e.g. Maria"
						className="input input-bordered w-full"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</label>
				{error && <div className="alert alert-error text-sm">{error}</div>}
				<div className="-mx-4 px-4 py-3 border-t border-base-300 flex items-center justify-end gap-2">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<button type="submit" className="btn btn-primary" disabled={isSubmitting}>
						{isSubmitting ? <span className="loading loading-spinner loading-sm" /> : "Create"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
