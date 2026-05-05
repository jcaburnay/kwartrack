import { useState } from "react";
import { NewGroupModal } from "../components/accounts/NewGroupModal";
import { useAccountGroups } from "../hooks/useAccountGroups";
import { useAccounts } from "../hooks/useAccounts";
import { supabase } from "../lib/supabase";

export function SettingsGroupsPage() {
	const { groups, isLoading, refetch } = useAccountGroups();
	const { accounts } = useAccounts();
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [error, setError] = useState<string | null>(null);

	const membersByGroup = groups.map((g) => ({
		group: g,
		memberCount: accounts.filter((a) => a.group_id === g.id).length,
	}));

	async function renameGroup(id: string) {
		setError(null);
		const { error: err } = await supabase
			.from("account_group")
			.update({ name: editingName.trim() })
			.eq("id", id);
		if (err) return setError(err.message);
		setEditingId(null);
		setEditingName("");
		await refetch();
	}

	async function deleteGroup(id: string, name: string, memberCount: number) {
		setError(null);
		if (memberCount > 0) {
			setError(`"${name}" has ${memberCount} member accounts. Reassign them first.`);
			return;
		}
		if (!window.confirm(`Delete group "${name}"?`)) return;
		const { error: err } = await supabase.from("account_group").delete().eq("id", id);
		if (err) return setError(err.message);
		await refetch();
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-lg font-semibold">Groups</h2>
				<button type="button" className="btn btn-cta btn-sm" onClick={() => setCreating(true)}>
					Create group
				</button>
			</div>
			<p className="text-sm text-base-content/60">
				Groups bucket accounts by institution (e.g. "Maya" grouping all Maya balances). An account
				belongs to at most one group; set membership via the Account form.
			</p>

			{error && <div className="alert alert-error text-sm">{error}</div>}

			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : membersByGroup.length === 0 ? (
				<p className="text-sm text-base-content/60">
					No groups yet. Bucket accounts to summarise totals together.
				</p>
			) : (
				<ul className="divide-y divide-base-300 rounded-box border border-base-300">
					{membersByGroup.map(({ group, memberCount }) => (
						<li key={group.id} className="flex items-center justify-between gap-3 p-3">
							{editingId === group.id ? (
								<div className="flex gap-2 flex-1">
									<input
										type="text"
										className="input input-bordered input-sm flex-1"
										value={editingName}
										onChange={(e) => setEditingName(e.target.value)}
									/>
									<button
										type="button"
										className="btn btn-sm btn-cta"
										onClick={() => renameGroup(group.id)}
									>
										Save
									</button>
									<button
										type="button"
										className="btn btn-sm btn-ghost"
										onClick={() => {
											setEditingId(null);
											setEditingName("");
										}}
									>
										Cancel
									</button>
								</div>
							) : (
								<>
									<div>
										<p className="font-medium">{group.name}</p>
										<p className="text-xs text-base-content/60">
											{memberCount} {memberCount === 1 ? "account" : "accounts"}
										</p>
									</div>
									<div className="flex gap-2">
										<button
											type="button"
											className="btn btn-xs btn-ghost"
											onClick={() => {
												setEditingId(group.id);
												setEditingName(group.name);
											}}
										>
											Rename
										</button>
										<button
											type="button"
											className="btn btn-xs btn-ghost text-error"
											onClick={() => deleteGroup(group.id, group.name, memberCount)}
										>
											Delete
										</button>
									</div>
								</>
							)}
						</li>
					))}
				</ul>
			)}

			{creating && (
				<NewGroupModal
					onCancel={() => setCreating(false)}
					onCreated={async () => {
						setCreating(false);
						await refetch();
					}}
				/>
			)}
		</div>
	);
}
