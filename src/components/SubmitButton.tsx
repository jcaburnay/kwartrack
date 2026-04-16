// src/components/SubmitButton.tsx
interface SubmitButtonProps {
	isSubmitting: boolean;
	label: string;
	className?: string;
	disabled?: boolean;
}

export function SubmitButton({ isSubmitting, label, className, disabled }: SubmitButtonProps) {
	return (
		<button
			type="submit"
			disabled={isSubmitting || disabled}
			className={`btn flex-1 whitespace-nowrap ${className ?? "btn-primary"}`}
		>
			{isSubmitting && <span className="loading loading-spinner loading-xs" />}
			{label}
		</button>
	);
}
