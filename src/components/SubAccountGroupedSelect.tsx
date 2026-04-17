interface SubAccountGroupedSelectProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	accounts: readonly { id: bigint; name: string; isStandalone: boolean }[];
	subAccounts: readonly {
		id: bigint;
		accountId: bigint;
		name: string;
		balanceCentavos: bigint;
		isDefault: boolean;
	}[];
}

export function SubAccountGroupedSelect({
	id,
	value,
	onChange,
	error,
	accounts,
	subAccounts,
}: SubAccountGroupedSelectProps) {
	return (
		<select
			id={id}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={`select select-bordered w-full${error ? " input-error" : ""}`}
		>
			<option value="">Select sub-account</option>
			{accounts.map((account) => {
				if (account.isStandalone) {
					const defaultSubAccount = subAccounts.find(
						(sa) => sa.accountId === account.id && sa.isDefault,
					);
					if (!defaultSubAccount) return null;
					return (
						<optgroup key={account.id.toString()} label={account.name}>
							<option value={defaultSubAccount.id.toString()}>{account.name}</option>
						</optgroup>
					);
				}
				const accountSubAccounts = subAccounts.filter(
					(sa) => sa.accountId === account.id && !sa.isDefault,
				);
				if (accountSubAccounts.length === 0) return null;
				return (
					<optgroup key={account.id.toString()} label={account.name}>
						{accountSubAccounts.map((subAccount) => (
							<option key={subAccount.id.toString()} value={subAccount.id.toString()}>
								{subAccount.name}
							</option>
						))}
					</optgroup>
				);
			})}
		</select>
	);
}
