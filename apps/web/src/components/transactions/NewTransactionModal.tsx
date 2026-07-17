import { useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import { bumpTransactionVersion } from "../../hooks/useTransactionVersion";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import type { TransactionInput } from "../../utils/transactionValidation";
import { Modal } from "../ui/Modal";
import {
	formDefaultsFromTransaction,
	TransactionForm,
	type TransactionFormValues,
} from "./TransactionForm";

type Props = {
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
	createTag: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	prefill?: Partial<TransactionFormValues>;
	onSaved: () => Promise<void> | void;
	onCancel: () => void;
};

export function NewTransactionModal({
	accounts,
	groups,
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
		bumpTransactionVersion();
		await onSaved();
	}

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title="New transaction" />
			<TransactionForm
				mode="create"
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
