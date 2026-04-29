import { formatCentavos } from "../../utils/currency";
import type { TransactionType } from "../../utils/transactionValidation";

type Props = {
	type: TransactionType;
	amountCentavos: number;
	feeCentavos?: number | null;
};

const MINUS = "−"; // proper minus sign U+2212, not hyphen — aligns with tabular nums

export function TransactionAmountCell({ type, amountCentavos, feeCentavos }: Props) {
	const formatted = formatCentavos(amountCentavos);
	let signed: string;
	let colorClass = "";
	if (type === "expense") {
		signed = `${MINUS}${formatted}`;
	} else if (type === "income") {
		signed = `+${formatted}`;
		colorClass = "text-success";
	} else {
		signed = formatted;
	}

	const showFee = feeCentavos != null && feeCentavos !== 0;

	return (
		<div className={`text-right font-mono whitespace-nowrap ${colorClass}`.trim()}>
			<div>{signed}</div>
			{showFee && (
				<div className="text-xs text-base-content/50">+{formatCentavos(feeCentavos)} fee</div>
			)}
		</div>
	);
}
