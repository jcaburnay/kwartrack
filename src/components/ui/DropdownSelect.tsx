/**
 * Native `<select>` wrapper with the project's standard sizing and width
 * behaviour: `select-sm`, `min-w-0 w-auto` so the control sizes to the longest
 * option label rather than DaisyUI's default 20rem floor.
 *
 * Variants:
 *   - `bordered` (default) — `select-bordered`, used inside chrome rows.
 *   - `ghost` — `select-ghost`, used as a quiet view-selector inside a header.
 *
 * Focus styling intentionally falls through to DaisyUI's default, which is the
 * project's a11y baseline (do not override per-call site).
 */

type Option<T extends string> = {
	value: T;
	label: string;
};

type Props<T extends string> = {
	ariaLabel: string;
	value: T;
	options: readonly Option<T>[];
	onChange: (next: T) => void;
	variant?: "bordered" | "ghost";
	className?: string;
};

export function DropdownSelect<T extends string>({
	ariaLabel,
	value,
	options,
	onChange,
	variant = "bordered",
	className = "",
}: Props<T>) {
	const variantClass = variant === "ghost" ? "select-ghost" : "select-bordered";
	return (
		<select
			aria-label={ariaLabel}
			className={`select select-sm ${variantClass} rounded-none min-w-0 w-auto ${className}`.trim()}
			value={value}
			onChange={(e) => onChange(e.target.value as T)}
		>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	);
}
