import { type ReactNode, useEffect } from "react";

type FabAction = {
	label: string;
	description: string;
	icon: ReactNode;
	onClick: () => void;
};

type Props = {
	actions: readonly FabAction[];
};

/**
 * DaisyUI 5 `fab` — open/close is driven by `:focus-within` on the focusable
 * `[role="button"]` trigger. `fab-close` swaps the trigger for a Close
 * indicator while the FAB is open. Action buttons blur on click so navigation
 * doesn't leave the FAB stuck open.
 */
export function Fab({ actions }: Props) {
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (
				e.key === "Escape" &&
				document.activeElement instanceof HTMLElement &&
				document.activeElement.closest(".fab")
			) {
				document.activeElement.blur();
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	const actionCircleClass =
		"btn btn-lg btn-circle bg-base-200 text-base-content border-base-content/10 group-hover:bg-success group-hover:text-success-content group-hover:border-success shadow-sm pointer-events-none";

	return (
		<div className="fab">
			{/* Dim + blur backdrop, only visible while the FAB is open
			   (`.fab:focus-within > .fab-backdrop` rule in index.css). Stays
			   click-through so leaving focus naturally closes the menu. */}
			<div aria-hidden="true" className="fab-backdrop" />
			{/* biome-ignore lint/a11y/useSemanticElements: DaisyUI's `fab` uses
			   `:focus-within` for open/close, which requires a focusable `div`
			   with `role="button"` — a real `<button>` has inconsistent focus
			   behavior across browsers (esp. Safari) for this pattern. */}
			<div
				tabIndex={0}
				role="button"
				aria-label="Open action menu"
				className="btn btn-lg btn-circle bg-success text-success-content border-success hover:bg-success shadow-lg"
			>
				<PlusIcon />
			</div>

			<div className="fab-close">
				<span className="text-sm font-medium text-base-content">Close</span>
				<span
					aria-hidden="true"
					className="btn btn-lg btn-circle bg-error text-error-content border-error hover:bg-error shadow-lg pointer-events-none"
				>
					<CloseIcon />
				</span>
			</div>

			{actions.map((a) => (
				<button
					key={a.label}
					type="button"
					aria-label={a.label}
					className="group bg-transparent border-0 p-0 cursor-pointer"
					onClick={(e) => {
						a.onClick();
						e.currentTarget.blur();
					}}
				>
					<span className="text-sm font-medium text-base-content group-hover:text-success transition-colors">
						{a.label}
					</span>
					<span className={actionCircleClass}>{a.icon}</span>
				</button>
			))}
		</div>
	);
}

function PlusIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M5 12h14" />
			<path d="M12 5v14" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	);
}
