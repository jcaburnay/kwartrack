import { useEffect, useState } from "react";
import { type BankEntry, filterBanks } from "../data/banks";
import { BankIcon } from "./BankIcon";
import { FormField, inputCls } from "./FormField";

interface BankInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
	onSelectBank: (bank: BankEntry) => void;
}

export function BankInput({
	label,
	id,
	error,
	onSelectBank,
	onChange,
	onFocus,
	onBlur,
	value,
	...inputProps
}: BankInputProps) {
	const [filterValue, setFilterValue] = useState(typeof value === "string" ? value : "");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const suggestions = filterBanks(filterValue);

	useEffect(() => {
		if (typeof value === "string") {
			setFilterValue(value);
		}
	}, [value]);

	return (
		<FormField label={label} id={id ?? ""} error={error}>
			<div
				className={`dropdown w-full${showSuggestions && suggestions.length > 0 ? " dropdown-open" : ""}`}
			>
				<input
					id={id}
					className={inputCls(error)}
					value={value}
					onChange={(e) => {
						setFilterValue(e.target.value);
						onChange?.(e);
					}}
					onFocus={(e) => {
						setShowSuggestions(true);
						onFocus?.(e);
					}}
					onBlur={(e) => {
						setTimeout(() => setShowSuggestions(false), 150);
						onBlur?.(e);
					}}
					{...inputProps}
				/>
				{showSuggestions && suggestions.length > 0 && (
					<ul className="dropdown-content menu bg-base-100 rounded-box z-20 w-full shadow-lg p-0">
						{suggestions.map((bank) => (
							<li key={bank.id}>
								<button
									type="button"
									className="text-sm"
									onMouseDown={() => {
										onSelectBank(bank);
										setShowSuggestions(false);
									}}
								>
									<BankIcon bankId={bank.id} name={bank.name} size={20} />
									{bank.name}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</FormField>
	);
}
