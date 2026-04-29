import { useState } from "react";
import type { Person } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import type { SplitInput } from "../../utils/splitValidation";
import { defaultSplitFormValues, SplitForm } from "./SplitForm";

type Props = {
	persons: readonly Person[];
	accounts: readonly Account[];
	tags: readonly Tag[];
	createPerson: (name: string) => Promise<Person | null>;
	createSplit: (input: SplitInput) => Promise<{ error: string | null }>;
	onSaved: () => void;
	onCancel: () => void;
};

export function NewSplitModal({
	persons,
	accounts,
	tags,
	createPerson,
	createSplit,
	onSaved,
	onCancel,
}: Props) {
	const today = new Date().toISOString().slice(0, 10);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(input: SplitInput) {
		setSubmitError(null);
		setIsSubmitting(true);
		const result = await createSplit(input);
		setIsSubmitting(false);
		if (result.error) return setSubmitError(result.error);
		onSaved();
	}

	return (
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-split-title"
		>
			<div className="modal-box max-w-lg">
				<h3 id="new-split-title" className="font-semibold text-lg mb-3">
					New split
				</h3>
				<SplitForm
					defaults={defaultSplitFormValues(today)}
					persons={persons}
					accounts={accounts}
					tags={tags}
					createPerson={createPerson}
					submitLabel="Create"
					submitError={submitError}
					isSubmitting={isSubmitting}
					onSubmit={handleSubmit}
					onCancel={onCancel}
				/>
			</div>
			<button type="button" className="modal-backdrop" onClick={onCancel} aria-label="Dismiss" />
		</div>
	);
}
