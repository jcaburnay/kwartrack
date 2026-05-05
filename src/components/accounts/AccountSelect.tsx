import type { Account, AccountGroup } from "../../utils/accountBalances";
import { groupAccountsForPicker } from "../../utils/accountBalances";

type Props = {
	label: string;
	placeholder: string;
	value: string | null;
	onChange: (id: string | null) => void;
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	className?: string;
	disabled?: boolean;
};

/**
 * Account picker rendered as a native `<select>` with `<optgroup>` per
 * user-defined group. Pass `accounts` already filtered (e.g. archived removed)
 * — this component preserves the input order within each bucket.
 */
export function AccountSelect({
	label,
	placeholder,
	value,
	onChange,
	accounts,
	groups,
	className,
	disabled,
}: Props) {
	const grouped = groupAccountsForPicker(accounts, groups);
	return (
		<label className={className ?? "floating-label"}>
			<span>{label}</span>
			<select
				className="select select-bordered w-full"
				value={value ?? ""}
				onChange={(e) => onChange(e.target.value || null)}
				disabled={disabled}
			>
				<option value="">{placeholder}</option>
				{grouped.map((g) => (
					<optgroup key={g.key} label={g.label}>
						{g.accounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</optgroup>
				))}
			</select>
		</label>
	);
}
