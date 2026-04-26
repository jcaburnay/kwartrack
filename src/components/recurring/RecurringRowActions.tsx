import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Recurring } from "../../utils/recurringFilters";

type Props = {
	recurring: Recurring;
	onEdit: (r: Recurring) => void;
	onTogglePaused: (id: string, currentlyPaused: boolean) => Promise<{ error: string | null }>;
	onDelete: (id: string) => Promise<{ error: string | null }>;
};

const MENU_MIN_HEIGHT = 120;

function computePosition(rect: DOMRect) {
	const spaceBelow = window.innerHeight - rect.bottom;
	const flipUp = spaceBelow < MENU_MIN_HEIGHT && rect.top > MENU_MIN_HEIGHT;
	return {
		top: flipUp ? rect.top + window.scrollY - MENU_MIN_HEIGHT : rect.bottom + window.scrollY + 4,
		right: window.innerWidth - rect.right,
	};
}

export function RecurringRowActions({ recurring, onEdit, onTogglePaused, onDelete }: Props) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, right: 0 });
	const buttonRef = useRef<HTMLButtonElement>(null);

	function toggle() {
		if (!open && buttonRef.current) {
			setPos(computePosition(buttonRef.current.getBoundingClientRect()));
		}
		setOpen((v) => !v);
	}

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		const closeOnScroll = () => setOpen(false);
		window.addEventListener("keydown", onKey);
		window.addEventListener("scroll", closeOnScroll, true);
		window.addEventListener("resize", closeOnScroll);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", closeOnScroll, true);
			window.removeEventListener("resize", closeOnScroll);
		};
	}, [open]);

	async function togglePaused() {
		setOpen(false);
		const { error } = await onTogglePaused(recurring.id, recurring.is_paused);
		if (error) window.alert(`Update failed: ${error}`);
	}

	async function hardDelete() {
		setOpen(false);
		if (
			!window.confirm(
				`Delete recurring "${recurring.service}"? Past transactions will remain but lose their link. This cannot be undone.`,
			)
		) {
			return;
		}
		const { error } = await onDelete(recurring.id);
		if (error) window.alert(`Delete failed: ${error}`);
	}

	const canPause = !recurring.is_completed;

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				className="btn btn-ghost btn-xs"
				aria-label="Row actions"
				aria-expanded={open}
				onClick={toggle}
			>
				⋯
			</button>
			{open &&
				createPortal(
					<>
						<button
							type="button"
							className="fixed inset-0 z-40 cursor-default"
							onClick={() => setOpen(false)}
							aria-label="Dismiss menu"
						/>
						<ul
							className="menu bg-base-100 rounded-box shadow-md z-50 p-1 min-w-[10rem] absolute"
							style={{ top: pos.top, right: pos.right }}
						>
							<li>
								<button
									type="button"
									onClick={() => {
										setOpen(false);
										onEdit(recurring);
									}}
								>
									Edit
								</button>
							</li>
							{canPause && (
								<li>
									<button type="button" onClick={togglePaused}>
										{recurring.is_paused ? "Resume" : "Pause"}
									</button>
								</li>
							)}
							<li>
								<button type="button" className="text-error" onClick={hardDelete}>
									Delete
								</button>
							</li>
						</ul>
					</>,
					document.body,
				)}
		</>
	);
}
