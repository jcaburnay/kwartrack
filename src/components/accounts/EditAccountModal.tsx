import type { Account, AccountGroup } from "../../utils/accountBalances";
import { ACCOUNT_TYPE_NOUN_PHRASE } from "../../utils/accountValidation";
import { Modal } from "../ui/Modal";
import { CashEWalletSavingsForm } from "./type-forms/CashEWalletSavingsForm";
import { CreditForm } from "./type-forms/CreditForm";
import { TimeDepositForm } from "./type-forms/TimeDepositForm";

type Props = {
	account: Account;
	groups: readonly AccountGroup[];
	onRefetchGroups: () => Promise<void>;
	onSaved: () => void;
	onCancel: () => void;
};

export function EditAccountModal({ account, groups, onRefetchGroups, onSaved, onCancel }: Props) {
	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title={`Edit ${ACCOUNT_TYPE_NOUN_PHRASE[account.type]}`} />
			{(account.type === "cash" || account.type === "e-wallet" || account.type === "savings") && (
				<CashEWalletSavingsForm
					type={account.type}
					mode="edit"
					initial={account}
					groups={groups}
					onRefetchGroups={onRefetchGroups}
					onSaved={onSaved}
					onCancel={onCancel}
				/>
			)}
			{account.type === "credit" && (
				<CreditForm
					mode="edit"
					initial={account}
					groups={groups}
					onRefetchGroups={onRefetchGroups}
					onSaved={onSaved}
					onCancel={onCancel}
				/>
			)}
			{account.type === "time-deposit" && (
				<TimeDepositForm
					mode="edit"
					initial={account}
					groups={groups}
					onRefetchGroups={onRefetchGroups}
					onSaved={onSaved}
					onCancel={onCancel}
				/>
			)}
		</Modal>
	);
}
