import { useState } from "react";
import type { Person } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { centavosToPesos } from "../../utils/currency";
import type { SplitMethod } from "../../utils/splitMath";
import type { SplitInput } from "../../utils/splitValidation";
import { type SplitFormDefaults, SplitForm } from "./SplitForm";
import type { ParticipantRow } from "./SplitParticipantList";

type Props = {
	split: {
		id: string;
		description: string;
		total_centavos: number;
		date: string;
		paid_from_account_id: string;
		tag_id: string;
		method: SplitMethod;
	};
	participantRows: ParticipantRow[];
	persons: readonly Person[];
	accounts: readonly Account[];
	tags: readonly Tag[];
	createPerson: (name: string) => Promise<Person | null>;
	updateSplit: (id: string, input: SplitInput) => Promise<{ error: string | null }>;
	onSaved: () => void;
	onCancel: () => void;
};

export function EditSplitModal({
	split,
	participantRows,
	persons,
	accounts,
	tags,
	createPerson,
	updateSplit,
	onSaved,
	onCancel,
}: Props) {
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const defaults: SplitFormDefaults = {
		description: split.description,
		totalPesos: centavosToPesos(split.total_centavos),
		date: split.date,
		paidFromAccountId: split.paid_from_account_id,
		tagId: split.tag_id,
		method: split.method,
		rows: participantRows,
	};

	async function handleSubmit(input: SplitInput) {
		setSubmitError(null);
		setIsSubmitting(true);
		const result = await updateSplit(split.id, input);
		setIsSubmitting(false);
		if (result.error) return setSubmitError(result.error);
		onSaved();
	}

	return (
		<div className="modal modal-open" role="dialog" aria-modal="true">
			<div className="modal-box max-w-lg">
				<h3 className="font-semibold text-lg mb-3">Edit split</h3>
				<SplitForm
					defaults={defaults}
					persons={persons}
					accounts={accounts}
					tags={tags}
					createPerson={createPerson}
					submitLabel="Save"
					submitError={submitError}
					isSubmitting={isSubmitting}
					onSubmit={handleSubmit}
					onCancel={onCancel}
				/>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={onCancel}
				aria-label="Dismiss"
			/>
		</div>
	);
}
