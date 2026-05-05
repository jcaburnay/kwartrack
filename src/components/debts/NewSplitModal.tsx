import { useState } from "react";
import type { Person } from "../../hooks/usePersons";
import type { Tag } from "../../hooks/useTags";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import type { SplitInput } from "../../utils/splitValidation";
import { Modal } from "../ui/Modal";
import { defaultSplitFormValues, SplitForm } from "./SplitForm";

type Props = {
	persons: readonly Person[];
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
	createPerson: (name: string) => Promise<Person | null>;
	createSplit: (input: SplitInput) => Promise<{ error: string | null }>;
	onSaved: () => void;
	onCancel: () => void;
};

export function NewSplitModal({
	persons,
	accounts,
	groups,
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
		<Modal onClose={onCancel} size="lg">
			<Modal.Header title="New split" />
			<SplitForm
				defaults={defaultSplitFormValues(today)}
				persons={persons}
				accounts={accounts}
				groups={groups}
				tags={tags}
				createPerson={createPerson}
				submitLabel="Create"
				submitError={submitError}
				isSubmitting={isSubmitting}
				onSubmit={handleSubmit}
				onCancel={onCancel}
			/>
		</Modal>
	);
}
