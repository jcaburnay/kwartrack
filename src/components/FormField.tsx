import { cloneElement, isValidElement } from "react";

interface FormFieldProps {
	label: string;
	id: string;
	error?: string;
	children: React.ReactNode;
}

export function FormField({ label, id, error, children }: FormFieldProps) {
	const errorId = error ? `${id}-error` : undefined;

	const content = isValidElement(children)
		? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
				"aria-invalid": !!error,
				"aria-describedby": errorId,
			})
		: children;
	return (
		<div>
			<label className="label" htmlFor={id}>
				<span className="label-text text-sm">{label}</span>
			</label>
			{content}
			{error && (
				<p id={errorId} className="text-error text-xs mt-1">
					{error}
				</p>
			)}
		</div>
	);
}

export function inputCls(error?: string) {
	return `input input-bordered w-full${error ? " input-error" : ""}`;
}
