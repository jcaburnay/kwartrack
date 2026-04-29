import { useState } from "react";
import { useNavigate } from "react-router";
import { Fab } from "./Fab";

const ACTIONS = [
	{
		label: "New Transaction",
		description: "Expense, income, or transfer.",
		to: "/?modal=new-transaction",
	},
	{
		label: "New Account",
		description: "Cash, e-wallet, savings, credit, or time deposit.",
		to: "/?modal=new-account",
	},
	{
		label: "New Recurring",
		description: "Subscription, installment, or recurring income.",
		to: "/?modal=new-recurring",
	},
	{
		label: "New Split",
		description: "Splitwise-style group expense.",
		to: "/?modal=new-split",
	},
	{ label: "New Debt", description: "Standalone IOU.", to: "/?modal=new-debt" },
] as const;

export function GlobalFab() {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();

	const actions = ACTIONS.map((a) => ({
		label: a.label,
		description: a.description,
		onClick: () => navigate(a.to),
	}));

	return (
		<Fab
			actions={actions}
			isOpen={open}
			onToggle={() => setOpen((v) => !v)}
			onDismiss={() => setOpen(false)}
		/>
	);
}
