import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import { bumpTransactionVersion } from "../../hooks/useTransactionVersion";
import { supabase } from "../../lib/supabase";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import type { Transaction } from "../../utils/transactionFilters";
import type { TransactionInput } from "../../utils/transactionValidation";
import { Modal } from "../ui/Modal";
import { formDefaultsFromTransaction, TransactionForm } from "./TransactionForm";

type Props = {
	transaction: Transaction;
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	onSaved: () => Promise<void> | void;
	onCancel: () => void;
};

export function EditTransactionModal({
	transaction,
	accounts,
	groups,
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
		bumpTransactionVersion();
		await onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="Edit transaction" />
			<TransactionForm
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
