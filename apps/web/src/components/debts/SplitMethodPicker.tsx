import { useId } from "react";
import type { SplitMethod } from "../../utils/splitMath";

type Props = {
	method: SplitMethod;
	onChange: (m: SplitMethod) => void;
};

const METHODS: { value: SplitMethod; label: string }[] = [
	{ value: "equal", label: "Equal" },
	{ value: "exact", label: "Exact" },
	{ value: "percentage", label: "%" },
	{ value: "shares", label: "Shares" },
];

export function SplitMethodPicker({ method, onChange }: Props) {
	const groupName = useId();
	return (
		<div className="flex flex-col gap-1">
			<span className="label-text text-xs">Split method</span>
			<div role="radiogroup" aria-label="Split method" className="tabs tabs-box w-full">
				{METHODS.map((m) => {
					const active = method === m.value;
					return (
						<label
							key={m.value}
							className={`tab flex-1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-base-content/60 ${active ? "tab-active" : ""}`}
						>
							<input
								type="radio"
								name={groupName}
								className="sr-only"
								checked={active}
								onChange={() => onChange(m.value)}
							/>
							{m.label}
						</label>
					);
				})}
			</div>
		</div>
	);
}
