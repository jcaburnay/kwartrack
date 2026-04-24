/**
 * Floating action button. Slice 2 ships with a single entry (New Account);
 * later slices add entries for Transaction, Recurring, Debt, Split.
 */
type FabAction = {
	label: string;
	description: string;
	onClick: () => void;
};

type Props = {
	actions: readonly FabAction[];
	isOpen: boolean;
	onToggle: () => void;
	onDismiss: () => void;
};

export function Fab({ actions, isOpen, onToggle, onDismiss }: Props) {
	return (
		<>
			{isOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-base-200/60 z-30"
					onClick={onDismiss}
					aria-label="Dismiss action menu"
				/>
			)}

			<div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
				{isOpen &&
					actions.map((a) => (
						<button
							key={a.label}
							type="button"
							className="btn btn-primary shadow-md"
							onClick={() => {
								a.onClick();
								onDismiss();
							}}
						>
							{a.label}
						</button>
					))}
				<button
					type="button"
					className="btn btn-circle btn-primary shadow-lg text-xl"
					aria-label={isOpen ? "Close action menu" : "Open action menu"}
					aria-expanded={isOpen}
					onClick={onToggle}
				>
					{isOpen ? "×" : "+"}
				</button>
			</div>
		</>
	);
}
