import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import { Modal } from "../ui/Modal";
import { SubmitButton } from "../ui/SubmitButton";

type Props = {
	group: AccountGroup;
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	onClose: () => void;
	onChanged: () => void;
	onRequestDelete: (group: AccountGroup) => void;
};

export function ManageGroupMembersModal({
	group,
	accounts,
	groups,
	onClose,
	onChanged,
	onRequestDelete,
}: Props) {
	const initialMemberIds = useMemo(
		() =>
			new Set(accounts.filter((a) => a.group_id === group.id && !a.is_archived).map((a) => a.id)),
		[accounts, group.id],
	);

	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialMemberIds));
	const [search, setSearch] = useState("");
	const [renameValue, setRenameValue] = useState(group.name);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const groupNameById = useMemo(() => {
		const m = new Map<string, string>();
		for (const g of groups) m.set(g.id, g.name);
		return m;
	}, [groups]);

	const visibleAccounts = useMemo(() => {
		const q = search.trim().toLowerCase();
		const visible = accounts.filter((a) => !a.is_archived);
		if (!q) return visible;
		return visible.filter((a) => a.name.toLowerCase().includes(q));
	}, [accounts, search]);

	const inGroup = visibleAccounts.filter((a) => selectedIds.has(a.id));
	const available = visibleAccounts.filter((a) => !selectedIds.has(a.id));

	const { added, removed } = useMemo(() => {
		const a: string[] = [];
		const r: string[] = [];
		for (const id of selectedIds) {
			if (!initialMemberIds.has(id)) a.push(id);
		}
		for (const id of initialMemberIds) {
			if (!selectedIds.has(id)) r.push(id);
		}
		return { added: a, removed: r };
	}, [selectedIds, initialMemberIds]);

	const trimmedRename = renameValue.trim();
	const renameDirty = trimmedRename !== group.name && trimmedRename.length > 0;
	const renameInvalid = trimmedRename.length === 0;
	const memberChangeCount = added.length + removed.length;
	const changeCount = memberChangeCount + (renameDirty ? 1 : 0);

	function handleDelete() {
		if (changeCount > 0) {
			setSubmitError("Save or cancel your pending changes before deleting the group.");
			return;
		}
		if (initialMemberIds.size > 0) {
			setSubmitError(
				`"${group.name}" has ${initialMemberIds.size} member ${initialMemberIds.size === 1 ? "account" : "accounts"}. Reassign them first.`,
			);
			return;
		}
		onRequestDelete(group);
	}

	function toggle(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	async function save() {
		if (changeCount === 0 || renameInvalid) return;
		setSubmitError(null);
		setIsSaving(true);
		try {
			if (renameDirty) {
				const { error } = await supabase
					.from("account_group")
					.update({ name: trimmedRename })
					.eq("id", group.id);
				if (error) throw new Error(error.message);
			}
			if (added.length > 0) {
				const { error } = await supabase
					.from("account")
					.update({ group_id: group.id })
					.in("id", added);
				if (error) throw new Error(error.message);
			}
			if (removed.length > 0) {
				const { error } = await supabase
					.from("account")
					.update({ group_id: null })
					.in("id", removed);
				if (error) throw new Error(error.message);
			}
			onChanged();
			onClose();
		} catch (e) {
			setSubmitError(e instanceof Error ? e.message : "Failed to save changes");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<Modal onClose={onClose} size="md">
			<Modal.Header title={`Manage members of "${group.name}"`} />

			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<input
						type="text"
						aria-label="Group name"
						className={`input input-bordered input-sm w-full ${renameInvalid ? "input-error" : ""}`}
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
					/>
					{renameInvalid && <span className="text-xs text-error">Group name can’t be empty.</span>}
				</div>

				<input
					type="search"
					placeholder="Search accounts…"
					className="input input-bordered input-sm w-full"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>

				{accounts.filter((a) => !a.is_archived).length === 0 ? (
					<p className="text-sm text-base-content/60 py-2">
						You have no accounts yet. Create one first to assign it to a group.
					</p>
				) : (
					<div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
						<MembersSection
							title="In this group"
							accounts={inGroup}
							selectedIds={selectedIds}
							onToggle={toggle}
							groupNameById={groupNameById}
							currentGroupId={group.id}
							emptyText="No accounts in this group yet."
						/>
						<MembersSection
							title="Available"
							accounts={available}
							selectedIds={selectedIds}
							onToggle={toggle}
							groupNameById={groupNameById}
							currentGroupId={group.id}
							emptyText={
								search ? "No matching accounts." : "Every account is already in this group."
							}
						/>
					</div>
				)}

				{submitError && <div className="alert alert-error text-sm">{submitError}</div>}
			</div>

			<Modal.Footer>
				<button
					type="button"
					className="btn btn-sm btn-ghost text-error mr-auto"
					onClick={handleDelete}
				>
					Delete group
				</button>
				<button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
					Cancel
				</button>
				<SubmitButton
					type="button"
					className="btn btn-sm btn-primary"
					loading={isSaving}
					disabled={changeCount === 0 || renameInvalid}
					onClick={save}
				>
					{changeCount === 0
						? "Save"
						: `Save ${changeCount} ${changeCount === 1 ? "change" : "changes"}`}
				</SubmitButton>
			</Modal.Footer>
		</Modal>
	);
}

type SectionProps = {
	title: string;
	accounts: readonly Account[];
	selectedIds: Set<string>;
	onToggle: (id: string) => void;
	groupNameById: Map<string, string>;
	currentGroupId: string;
	emptyText: string;
};

function MembersSection({
	title,
	accounts,
	selectedIds,
	onToggle,
	groupNameById,
	currentGroupId,
	emptyText,
}: SectionProps) {
	return (
		<div className="flex flex-col gap-1">
			<p className="text-xs uppercase tracking-wide font-semibold text-base-content/50">{title}</p>
			{accounts.length === 0 ? (
				<p className="text-xs text-base-content/50 italic px-2 py-1">{emptyText}</p>
			) : (
				<ul className="flex flex-col">
					{accounts.map((a) => {
						const otherGroupId = a.group_id && a.group_id !== currentGroupId ? a.group_id : null;
						const otherGroupName = otherGroupId ? groupNameById.get(otherGroupId) : null;
						return (
							<li key={a.id}>
								<label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-base-200 cursor-pointer">
									<input
										type="checkbox"
										className="checkbox checkbox-sm"
										checked={selectedIds.has(a.id)}
										onChange={() => onToggle(a.id)}
									/>
									<span className="flex-1 text-sm">{a.name}</span>
									{otherGroupName && (
										<span className="text-xs text-base-content/50">(in {otherGroupName})</span>
									)}
								</label>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
