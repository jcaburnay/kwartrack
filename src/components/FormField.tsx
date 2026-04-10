interface FormFieldProps {
	label: string;
	id: string;
	error?: string;
	children: React.ReactNode;
}

export function FormField({ label, id, error, children }: FormFieldProps) {
	return (
		<div>
			<label className="label" htmlFor={id}>
				<span className="label-text text-sm">{label}</span>
			</label>
			{children}
			{error && <p className="text-error text-xs mt-1">{error}</p>}
		</div>
	);
}

export function inputCls(error?: string) {
	return `input input-bordered w-full${error ? " input-error" : ""}`;
}
