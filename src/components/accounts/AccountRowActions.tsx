import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import type { Account } from "../../utils/accountBalances";

type Props = {
	account: Account;
	onEdit: (account: Account) => void;
	onChanged: () => Promise<void> | void;
};

const MENU_MIN_HEIGHT = 150; // enough for 3 menu items

function computePosition(triggerRect: DOMRect) {
	const spaceBelow = window.innerHeight - triggerRect.bottom;
	const flipUp = spaceBelow < MENU_MIN_HEIGHT && triggerRect.top > MENU_MIN_HEIGHT;
	return {
		top: flipUp
			? triggerRect.top + window.scrollY - MENU_MIN_HEIGHT
			: triggerRect.bottom + window.scrollY + 4,
		right: window.innerWidth - triggerRect.right,
	};
}

export function AccountRowActions({ account, onEdit, onChanged }: Props) {
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
		const onScrollOrResize = () => setOpen(false);
		window.addEventListener("keydown", onKey);
		window.addEventListener("scroll", onScrollOrResize, true);
		window.addEventListener("resize", onScrollOrResize);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", onScrollOrResize, true);
			window.removeEventListener("resize", onScrollOrResize);
		};
	}, [open]);

	async function toggleArchive() {
		setOpen(false);
		await supabase
			.from("account")
			.update({ is_archived: !account.is_archived })
			.eq("id", account.id);
		await onChanged();
	}

	async function hardDelete() {
		setOpen(false);
		if (
			!window.confirm(
				`Delete "${account.name}"? This is reserved for accounts created in error. Prefer archive if you just want to retire it.`,
			)
		) {
			return;
		}
		const { error } = await supabase.from("account").delete().eq("id", account.id);
		if (error) {
			window.alert(`Delete failed: ${error.message}`);
			return;
		}
		await onChanged();
	}

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
							className="menu bg-base-100 rounded-box shadow-md z-50 p-1 min-w-[12rem] absolute"
							style={{ top: pos.top, right: pos.right }}
						>
							<li>
								<button
									type="button"
									onClick={() => {
										setOpen(false);
										onEdit(account);
									}}
								>
									Edit
								</button>
							</li>
							<li>
								<button type="button" onClick={toggleArchive}>
									{account.is_archived ? "Unarchive" : "Archive"}
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
