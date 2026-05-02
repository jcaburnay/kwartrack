import type { SplitMethod } from "../../utils/splitMath";

type Props = {
	method: SplitMethod;
	onChange: (m: SplitMethod) => void;
};

const LABELS: Record<SplitMethod, string> = {
	equal: "Equal",
	exact: "Exact",
	percentage: "%",
	shares: "Shares",
};

export function SplitMethodPicker({ method, onChange }: Props) {
	return (
		<div role="toolbar" aria-label="Method" className="join w-full">
			{(["equal", "exact", "percentage", "shares"] as const).map((m) => {
				const active = method === m;
				return (
					<button
						key={m}
						type="button"
						aria-pressed={active}
						className={`btn join-item flex-1 border border-base-content/40 ${
							active ? "btn-primary" : "btn-ghost"
						}`}
						onClick={() => onChange(m)}
					>
						{LABELS[m]}
					</button>
				);
			})}
		</div>
	);
}
