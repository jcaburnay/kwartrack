import {
	ArrowLeftRight,
	Building2,
	CalendarClock,
	HandCoins,
	Layers,
	Plus,
	Repeat,
	Users,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useMatch, useNavigate } from "react-router";
import { useAccounts, useSubAccounts } from "../hooks";
import { AccountModal } from "./AccountModal";
import { DebtModal } from "./DebtModal";
import { RecurringModal } from "./RecurringModal";
import { SplitModal } from "./SplitModal";
import { SubAccountModal } from "./SubAccountModal";
import { TransactionModal } from "./TransactionModal";

type ModalKey =
	| "transaction"
	| "subscription"
	| "installment"
	| "debt"
	| "split"
	| "subAccount"
	| "account";

interface ActionItem {
	key: ModalKey;
	label: string;
	icon: typeof Plus;
}

const ACTIONS: ActionItem[] = [
	{ key: "transaction", label: "New transaction", icon: ArrowLeftRight },
	{ key: "subscription", label: "New subscription", icon: Repeat },
	{ key: "installment", label: "New installment", icon: CalendarClock },
	{ key: "debt", label: "New debt", icon: HandCoins },
	{ key: "split", label: "New split", icon: Users },
	{ key: "subAccount", label: "New sub-account", icon: Layers },
	{ key: "account", label: "New account", icon: Building2 },
];

function blurActiveElement() {
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
}

export function Fab() {
	const [openModal, setOpenModal] = useState<ModalKey | null>(null);
	const navigate = useNavigate();
	const pendingNavigation = useRef(false);
	useAccounts({
		onInsert: (row) => {
			if (pendingNavigation.current) {
				pendingNavigation.current = false;
				navigate(`/accounts/${row.id.toString()}`);
			}
		},
	});

	const accountMatch = useMatch("/accounts/:id");
	const routeAccountId = accountMatch?.params.id ? BigInt(accountMatch.params.id) : null;
	const { subAccounts } = useSubAccounts();
	const defaultSourceSubAccountId = routeAccountId
		? (subAccounts.find((sa) => sa.accountId === routeAccountId)?.id ?? null)
		: null;
	const defaultAccountId = routeAccountId ?? undefined;

	const handleSelect = (key: ModalKey) => {
		setOpenModal(key);
		blurActiveElement();
	};

	return (
		<>
			{/* Mobile-only backdrop blur. md:hidden removes it on desktop entirely. */}
			<div
				className="fab-backdrop fixed inset-0 z-20 pointer-events-none opacity-0 bg-base-100/10 backdrop-blur-xs transition-opacity duration-200 md:hidden"
				aria-hidden="true"
			/>
			<div className="fab bottom-20 right-4 md:bottom-6 md:fab-content-right z-30">
				{/* Trigger — must use [tabindex] for daisyUI's :focus-within behavior */}
				<button
					type="button"
					tabIndex={0}
					aria-label="Create new"
					className="btn btn-primary btn-circle btn-lg shadow-lg"
				>
					<Plus size={22} />
				</button>

				{/* Close button — replaces the trigger visually when FAB is open */}
				<button
					type="button"
					aria-label="Close"
					className="fab-close flex items-center gap-3"
					onClick={blurActiveElement}
				>
					<span className="text-sm font-medium">Close</span>
					<span className="btn btn-error btn-circle btn-lg shadow-lg pointer-events-none">
						<X size={22} />
					</span>
				</button>

				{/* Speed-dial items: label outside, circle icon inside */}
				{ACTIONS.map(({ key, label, icon: Icon }) => (
					<button
						key={key}
						type="button"
						className="group flex items-center gap-3"
						onClick={() => handleSelect(key)}
					>
						<span className="text-sm font-medium group-hover:text-primary transition-colors">
							{label}
						</span>
						<span className="btn btn-circle btn-lg shadow-md group-hover:btn-primary pointer-events-none">
							<Icon size={22} />
						</span>
					</button>
				))}
			</div>
			{openModal === "transaction" && (
				<TransactionModal
					onClose={() => setOpenModal(null)}
					defaultSourceSubAccountId={defaultSourceSubAccountId ?? undefined}
				/>
			)}
			{openModal === "subscription" && (
				<RecurringModal
					onClose={() => setOpenModal(null)}
					mode="subscription"
					defaultSubAccountId={defaultSourceSubAccountId ?? undefined}
				/>
			)}
			{openModal === "installment" && (
				<RecurringModal
					onClose={() => setOpenModal(null)}
					mode="installment"
					defaultSubAccountId={defaultSourceSubAccountId ?? undefined}
				/>
			)}
			{openModal === "debt" && <DebtModal onClose={() => setOpenModal(null)} />}
			{openModal === "split" && <SplitModal onClose={() => setOpenModal(null)} />}
			{openModal === "subAccount" && (
				<SubAccountModal onClose={() => setOpenModal(null)} defaultAccountId={defaultAccountId} />
			)}
			{openModal === "account" && (
				<AccountModal
					onClose={() => setOpenModal(null)}
					onAccountCreated={() => {
						pendingNavigation.current = true;
					}}
				/>
			)}
		</>
	);
}
