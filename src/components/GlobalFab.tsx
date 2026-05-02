import { ArrowLeftRight, Building2, HandCoins, Repeat, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { Fab } from "./Fab";

const ICON_CLASS = "w-6 h-6";

// DaisyUI's `fab` stacks children bottom-up: the first item lands closest to
// the trigger, the last item ends up at the top. Order is intentional so the
// most-frequent action (New Transaction) sits closest to the thumb-resting
// FAB and the rarest (New Account) ends up at the top (Fitts's law).
const ACTIONS = [
	{
		label: "New Transaction",
		description: "Expense, income, or transfer.",
		to: "/?modal=new-transaction",
		icon: <ArrowLeftRight className={ICON_CLASS} />,
	},
	{
		label: "New Recurring",
		description: "Subscription, installment, or recurring income.",
		to: "/?modal=new-recurring",
		icon: <Repeat className={ICON_CLASS} />,
	},
	{
		label: "New Split",
		description: "Splitwise-style group expense.",
		to: "/?modal=new-split",
		icon: <Users className={ICON_CLASS} />,
	},
	{
		label: "New Debt",
		description: "Standalone IOU.",
		to: "/?modal=new-debt",
		icon: <HandCoins className={ICON_CLASS} />,
	},
	{
		label: "New Account",
		description: "Cash, e-wallet, savings, credit, or time deposit.",
		to: "/?modal=new-account",
		icon: <Building2 className={ICON_CLASS} />,
	},
] as const;

export function GlobalFab() {
	const navigate = useNavigate();

	const actions = ACTIONS.map((a) => ({
		label: a.label,
		description: a.description,
		icon: a.icon,
		onClick: () => navigate(a.to),
	}));

	return <Fab actions={actions} />;
}
