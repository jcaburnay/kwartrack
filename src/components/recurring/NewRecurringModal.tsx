import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import type { RecurringInput } from "../../utils/recurringValidation";
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
		<div className="modal modal-open" role="dialog" aria-modal="true">
			<div className="modal-box max-w-md">
				<h3 className="font-semibold text-lg mb-3">New recurring</h3>
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
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={onCancel}
				aria-label="Dismiss modal"
			/>
		</div>
	);
}
