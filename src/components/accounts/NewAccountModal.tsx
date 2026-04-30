import { useState } from "react";
import type { AccountGroup, AccountType } from "../../utils/accountBalances";
import {
	ACCOUNT_TYPE_LABEL,
	ACCOUNT_TYPE_NOUN_PHRASE,
	ACCOUNT_TYPES,
} from "../../utils/accountValidation";
import { Modal } from "../ui/Modal";
import { CashEWalletSavingsForm } from "./type-forms/CashEWalletSavingsForm";
import { CreditForm } from "./type-forms/CreditForm";
import { TimeDepositForm } from "./type-forms/TimeDepositForm";

type Props = {
	groups: readonly AccountGroup[];
	onRefetchGroups: () => Promise<void>;
	onSaved: () => void;
	onCancel: () => void;
};

const TYPE_DESCRIPTIONS: Record<AccountType, string> = {
	cash: "Physical cash on hand.",
	"e-wallet": "Maya, GCash, or similar.",
	savings: "Bank savings account.",
	credit: "Credit card with a limit.",
	"time-deposit": "Locked deposit with interest.",
};

export function NewAccountModal({ groups, onRefetchGroups, onSaved, onCancel }: Props) {
	const [type, setType] = useState<AccountType | null>(null);

	const title = type ? `New ${ACCOUNT_TYPE_NOUN_PHRASE[type]}` : "New account";

	return (
		<Modal onClose={onCancel} size="md">
			<Modal.Header title={title} />

			{type === null && (
				<div className="flex flex-col gap-2">
					{ACCOUNT_TYPES.map((t) => (
						<button
							key={t}
							type="button"
							className="btn btn-outline justify-start"
							onClick={() => setType(t)}
						>
							<span className="flex-1 text-left">
								<span className="block font-medium">{ACCOUNT_TYPE_LABEL[t]}</span>
								<span className="block text-xs text-base-content/60 font-normal">
									{TYPE_DESCRIPTIONS[t]}
								</span>
							</span>
						</button>
					))}
					<div className="flex items-center justify-end gap-2 pt-2 mt-3">
						<button type="button" className="btn btn-ghost" onClick={onCancel}>
							Cancel
						</button>
					</div>
				</div>
			)}

			{type !== null && (
				<>
					<button
						type="button"
						className="btn btn-ghost btn-xs mb-3 -mt-1 self-start"
						onClick={() => setType(null)}
					>
						← Change type
					</button>
					{(type === "cash" || type === "e-wallet" || type === "savings") && (
						<CashEWalletSavingsForm
							type={type}
							mode="create"
							groups={groups}
							onRefetchGroups={onRefetchGroups}
							onSaved={onSaved}
							onCancel={onCancel}
						/>
					)}
					{type === "credit" && (
						<CreditForm
							mode="create"
							groups={groups}
							onRefetchGroups={onRefetchGroups}
							onSaved={onSaved}
							onCancel={onCancel}
						/>
					)}
					{type === "time-deposit" && (
						<TimeDepositForm
							mode="create"
							groups={groups}
							onRefetchGroups={onRefetchGroups}
							onSaved={onSaved}
							onCancel={onCancel}
						/>
					)}
				</>
			)}
		</Modal>
	);
}
