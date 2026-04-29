import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";
import type { Account } from "../../utils/accountBalances";
import type { TransactionInput } from "../../utils/transactionValidation";
import {
	formDefaultsFromTransaction,
	TransactionForm,
	type TransactionFormValues,
} from "./TransactionForm";

type Props = {
	accounts: readonly Account[];
	tags: readonly Tag[];
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	prefill?: Partial<TransactionFormValues>;
	onSaved: () => Promise<void> | void;
	onCancel: () => void;
};

export function NewTransactionModal({
	accounts,
	tags,
	createTag,
	prefill,
	onSaved,
	onCancel,
}: Props) {
	const { user } = useAuth();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const defaults = formDefaultsFromTransaction(null, prefill);

	async function handleSubmit(input: TransactionInput) {
		if (!user) return;
		setSubmitError(null);
		setIsSubmitting(true);
		const { error } = await supabase.from("transaction").insert({
			user_id: user.id,
			amount_centavos: input.amountCentavos,
			type: input.type,
			tag_id: input.tagId,
			from_account_id: input.fromAccountId,
			to_account_id: input.toAccountId,
			fee_centavos: input.feeCentavos,
			description: input.description || null,
			date: input.date,
		});
		setIsSubmitting(false);
		if (error) {
			setSubmitError(error.message);
			return;
		}
		await onSaved();
	}

	return (
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-transaction-title"
		>
			<div className="modal-box max-w-md">
				<h3 id="new-transaction-title" className="font-semibold text-lg mb-3">
					New transaction
				</h3>
				<TransactionForm
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
