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
		const nextArchived = !account.is_archived;
		const accRes = await supabase
			.from("account")
			.update({ is_archived: nextArchived })
			.eq("id", account.id);
		if (accRes.error) {
			window.alert(`Archive failed: ${accRes.error.message}`);
			return;
		}
		// For TDs with a linked interest-posting recurring, mirror the archive
		// state on the recurring's pause state — archived TDs shouldn't keep
		// firing interest into themselves (spec §188). Two updates rather than
		// an atomic RPC: if the recurring pause fails, the account is already
		// archived but the recurring keeps firing. Surface the partial-failure
		// to the user so they can manually pause/unarchive to recover.
		if (account.interest_recurring_id) {
			const recRes = await supabase
				.from("recurring")
				.update({ is_paused: nextArchived })
				.eq("id", account.interest_recurring_id);
			if (recRes.error) {
				window.alert(
					`Account ${nextArchived ? "archived" : "unarchived"}, but couldn't ${
						nextArchived ? "pause" : "resume"
					} the linked interest recurring: ${recRes.error.message}. Try toggling archive again, or pause/resume the recurring manually.`,
				);
			}
		}
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
			// Friendly translation for the FK violation users hit when deleting a
			// time-deposit that still has a scheduled interest recurring pointing
			// at it (recurring.to_account_id is ON DELETE RESTRICT).
			const isFkBlock =
				account.type === "time-deposit" && /foreign key|violates|recurring/i.test(error.message);
			window.alert(
				isFkBlock
					? "This time deposit can't be deleted while interest postings are scheduled. Wait for maturity, or change the posting interval to at-maturity and re-try after maturity."
					: `Delete failed: ${error.message}`,
			);
			return;
		}
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
