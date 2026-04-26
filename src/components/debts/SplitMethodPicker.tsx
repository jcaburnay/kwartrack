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
		<div className="form-control">
			<div className="label">
				<span className="label-text">Method</span>
			</div>
			<div role="tablist" className="tabs tabs-box">
				{(["equal", "exact", "percentage", "shares"] as const).map((m) => (
					<button
						key={m}
						type="button"
						role="tab"
						className={`tab ${method === m ? "tab-active" : ""}`}
						onClick={() => onChange(m)}
					>
						{LABELS[m]}
					</button>
				))}
			</div>
		</div>
	);
}
