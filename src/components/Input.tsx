import type React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: React.ReactNode;
	error?: string;
	hint?: React.ReactNode;
}

export function Input({ label, id, error, hint, ...inputProps }: InputProps) {
	const errorId = error ? `${id}-error` : undefined;
	return (
		<div>
			<label className="label" htmlFor={id}>
				<span className="label-text text-sm">{label}</span>
			</label>
			<input
				id={id}
				className={`input input-bordered w-full${error ? " input-error" : ""}`}
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
