import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import type { Recurring } from "../../utils/recurringFilters";
import type { RecurringInput } from "../../utils/recurringValidation";
import { Modal } from "../ui/Modal";
import { formDefaultsFromRecurring, RecurringForm } from "./RecurringForm";

type Props = {
	recurring: Recurring;
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	updateRecurring: (
		id: string,
		partial: {
			service: string;
			amount_centavos: number;
			type: "expense" | "income" | "transfer";
			tag_id: string | null;
			from_account_id: string | null;
			to_account_id: string | null;
			fee_centavos: number | null;
			description: string | null;
			interval: Recurring["interval"];
			first_occurrence_date: string;
			remaining_occurrences: number | null;
		},
	) => Promise<{ error: string | null }>;
	onSaved: () => Promise<void> | void;
	onCancel: () => void;
};

export function EditRecurringModal({
	recurring,
	accounts,
	groups,
	tags,
	createTag,
	updateRecurring,
	onSaved,
	onCancel,
}: Props) {
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const defaults = formDefaultsFromRecurring(recurring);

	async function handleSubmit(input: RecurringInput) {
		setSubmitError(null);
		setIsSubmitting(true);
		const { error } = await updateRecurring(recurring.id, {
			service: input.service.trim(),
			amount_centavos: input.amountCentavos,
			type: input.type,
			tag_id: input.tagId,
			from_account_id: input.fromAccountId,
			to_account_id: input.toAccountId,
			fee_centavos: input.feeCentavos,
			description: input.description || null,
			interval: input.interval,
			first_occurrence_date: input.firstOccurrenceDate,
			remaining_occurrences: input.remainingOccurrences,
		});
		setIsSubmitting(false);
		if (error) {
			setSubmitError(error);
			return;
		}
		await onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="Edit recurring" />
			<RecurringForm
				mode="edit"
				accounts={accounts}
				groups={groups}
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
