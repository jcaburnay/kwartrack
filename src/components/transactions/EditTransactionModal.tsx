import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import { supabase } from "../../lib/supabase";
import type { Account } from "../../utils/accountBalances";
import type { Transaction } from "../../utils/transactionFilters";
import type { TransactionInput } from "../../utils/transactionValidation";
import { formDefaultsFromTransaction, TransactionForm } from "./TransactionForm";

type Props = {
	transaction: Transaction;
	accounts: readonly Account[];
	tags: readonly Tag[];
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	onSaved: () => Promise<void> | void;
	onCancel: () => void;
};

export function EditTransactionModal({
	transaction,
	accounts,
	tags,
	createTag,
	onSaved,
	onCancel,
}: Props) {
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const defaults = formDefaultsFromTransaction(transaction);

	async function handleSubmit(input: TransactionInput) {
		setSubmitError(null);
		setIsSubmitting(true);
		const { error } = await supabase
			.from("transaction")
			.update({
				amount_centavos: input.amountCentavos,
				type: input.type,
				tag_id: input.tagId,
				from_account_id: input.fromAccountId,
				to_account_id: input.toAccountId,
				fee_centavos: input.feeCentavos,
				description: input.description || null,
				date: input.date,
			})
			.eq("id", transaction.id);
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
			aria-labelledby="edit-transaction-title"
		>
			<div className="modal-box max-w-md">
				<h3 id="edit-transaction-title" className="font-semibold text-lg mb-3">
					Edit transaction
				</h3>
				<TransactionForm
					mode="edit"
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
