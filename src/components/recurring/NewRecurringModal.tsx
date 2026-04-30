import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import type { RecurringInput } from "../../utils/recurringValidation";
import { Modal } from "../ui/Modal";
import {
	formDefaultsFromRecurring,
	RecurringForm,
	type RecurringFormValues,
} from "./RecurringForm";

type Props = {
	accounts: readonly Account[];
	tags: readonly Tag[];
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	createRecurring: (input: RecurringInput) => Promise<{ error: string | null }>;
	prefill?: Partial<RecurringFormValues>;
	onSaved: () => Promise<void> | void;
	onCancel: () => void;
};

export function NewRecurringModal({
	accounts,
	tags,
	createTag,
	createRecurring,
	prefill,
	onSaved,
	onCancel,
}: Props) {
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const defaults = formDefaultsFromRecurring(null, prefill);

	async function handleSubmit(input: RecurringInput) {
		setSubmitError(null);
		setIsSubmitting(true);
		const { error } = await createRecurring(input);
		setIsSubmitting(false);
		if (error) {
			setSubmitError(error);
			return;
		}
		await onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="New recurring" />
			<RecurringForm
				mode="create"
				accounts={accounts}
				tags={tags}
				defaults={defaults}
				submitError={submitError}
				isSubmitting={isSubmitting}
				createTag={createTag}
				onSubmit={handleSubmit}
				onCancel={onCancel}
			/>
		</Modal>
	);
}
