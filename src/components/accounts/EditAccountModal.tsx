import type { Account, AccountGroup } from "../../utils/accountBalances";
import { ACCOUNT_TYPE_LABEL } from "../../utils/accountValidation";
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
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-account-title"
		>
			<div className="modal-box max-w-md">
				<h3 id="edit-account-title" className="font-semibold text-lg mb-1">
					Edit account
				</h3>
				<p className="text-xs text-base-content/60 mb-4">
					Type: {ACCOUNT_TYPE_LABEL[account.type]} (not editable)
				</p>
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
