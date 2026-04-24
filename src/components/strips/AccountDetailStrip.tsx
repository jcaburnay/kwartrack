import type { Account } from "../../utils/accountBalances";
import { CreditAccountStrip } from "./CreditAccountStrip";
import { TimeDepositStrip } from "./TimeDepositStrip";

type Props = {
	account: Account;
	onClear: () => void;
};

export function AccountDetailStrip({ account, onClear }: Props) {
	// Cash / e-wallet / savings strip is deferred to Slice 3 (needs this-month
	// inflow / outflow from transactions). Show a minimal selection chip instead.
	const hasStrip = account.type === "credit" || account.type === "time-deposit";

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span className="text-sm text-base-content/60">
					Selected: <strong className="text-base-content">{account.name}</strong>
				</span>
				<button type="button" className="btn btn-ghost btn-xs" onClick={onClear}>
					Clear selection
				</button>
			</div>
			{account.type === "credit" && <CreditAccountStrip account={account} />}
			{account.type === "time-deposit" && <TimeDepositStrip account={account} />}
			{!hasStrip && (
				<p className="text-sm text-base-content/60 italic px-1">
					This-month activity summary arrives with the Transactions slice.
				</p>
			)}
		</div>
	);
}
