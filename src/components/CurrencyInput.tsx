import type React from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
	label: React.ReactNode;
	id: string;
	error?: string;
	hint?: React.ReactNode;
}

export function CurrencyInput({
	label,
	id,
	error,
	hint,
	className,
	...inputProps
}: CurrencyInputProps) {
	const errorId = error ? `${id}-error` : undefined;
	return (
		<div>
			<label className="label" htmlFor={id}>
				<span className="label-text text-sm">{label}</span>
			</label>
			<input
				id={id}
				type="number"
				step="0.01"
				inputMode="decimal"
				placeholder="0.00"
				className={`input input-bordered w-full${error ? " input-error" : ""}${className ? ` ${className}` : ""}`}
				aria-invalid={!!error}
				aria-describedby={errorId}
				{...inputProps}
			/>
			{hint}
			{error && (
				<p id={errorId} className="text-error text-xs mt-1">
					{error}
				</p>
			)}
		</div>
	);
}
