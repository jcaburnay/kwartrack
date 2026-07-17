import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
	loading?: boolean;
	spinnerSize?: "xs" | "sm" | "md";
};

export function SubmitButton({
	loading = false,
	spinnerSize = "sm",
	disabled,
	className,
	children,
	...rest
}: Props) {
	return (
		<button {...rest} disabled={disabled || loading} className={`relative ${className ?? ""}`}>
			<span className={loading ? "invisible" : ""}>{children}</span>
			{loading && (
				<span className="absolute inset-0 flex items-center justify-center">
					<span className={`loading loading-spinner loading-${spinnerSize}`} />
				</span>
			)}
		</button>
	);
}
