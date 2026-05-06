import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bumpTransactionVersion } from "../../hooks/useTransactionVersion";
import { supabase } from "../../lib/supabase";
import type { Transaction } from "../../utils/transactionFilters";

type Props = {
	transaction: Transaction;
	onEdit: (tx: Transaction) => void;
	onChanged: () => Promise<void> | void;
};

const MENU_MIN_HEIGHT = 100;

function computePosition(rect: DOMRect) {
	const spaceBelow = window.innerHeight - rect.bottom;
	const flipUp = spaceBelow < MENU_MIN_HEIGHT && rect.top > MENU_MIN_HEIGHT;
	return {
		top: flipUp ? rect.top + window.scrollY - MENU_MIN_HEIGHT : rect.bottom + window.scrollY + 4,
		right: window.innerWidth - rect.right,
	};
}

export function TransactionRowActions({ transaction, onEdit, onChanged }: Props) {
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

	async function hardDelete() {
		setOpen(false);
		if (
			!window.confirm(
				"Delete this transaction? Account balances will be reverted. This cannot be undone.",
			)
		) {
			return;
		}
		const { error } = await supabase.from("transaction").delete().eq("id", transaction.id);
		if (error) {
			window.alert(`Delete failed: ${error.message}`);
			return;
		}
		bumpTransactionVersion();
		await onChanged();
	}

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				className="btn btn-ghost btn-xs touch-target"
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
										onEdit(transaction);
									}}
								>
									Edit
								</button>
							</li>
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
