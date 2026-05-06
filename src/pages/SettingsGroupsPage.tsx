import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { ManageGroupMembersModal } from "../components/accounts/ManageGroupMembersModal";
import { NewGroupModal } from "../components/accounts/NewGroupModal";
import { useAccountGroups } from "../hooks/useAccountGroups";
import { useAccounts } from "../hooks/useAccounts";
import { supabase } from "../lib/supabase";
import type { AccountGroup } from "../utils/accountBalances";

export function SettingsGroupsPage() {
	const { groups, isLoading, refetch: refetchGroups } = useAccountGroups();
	const { accounts, refetch: refetchAccounts } = useAccounts();
	const [creating, setCreating] = useState(false);
	const [managingId, setManagingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const groupsWithMembers = groups.map((g) => {
		const members = accounts.filter((a) => a.group_id === g.id && !a.is_archived);
		return { group: g, members };
	});

	async function deleteGroup(group: AccountGroup) {
		setError(null);
		if (!window.confirm(`Delete group "${group.name}"?`)) return;
		const { error: err } = await supabase.from("account_group").delete().eq("id", group.id);
		if (err) return setError(err.message);
		setManagingId(null);
		await refetchGroups();
	}

	async function refreshAll() {
		await Promise.all([refetchGroups(), refetchAccounts()]);
	}

	const managing = managingId ? groupsWithMembers.find((g) => g.group.id === managingId) : null;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-lg font-semibold">Groups</h2>
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
					Create group
				</button>
			</div>
			<p className="text-sm text-base-content/60">
				Groups bucket accounts by institution (e.g. "Maya" grouping all Maya balances). An account
				belongs to at most one group. Click a group to manage its accounts.
			</p>

			{error && <div className="alert alert-error text-sm">{error}</div>}

			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : groupsWithMembers.length === 0 ? (
				<p className="text-sm text-base-content/60">
					No groups yet. Bucket accounts to summarise totals together.
				</p>
			) : (
				<ul className="divide-y divide-base-300 rounded-box border border-base-300">
					{groupsWithMembers.map(({ group, members }) => {
						const memberCount = members.length;
						const previewNames = members.slice(0, 3).map((a) => a.name);
						const previewSuffix = memberCount > 3 ? `, +${memberCount - 3}` : "";
						const subtitle =
							memberCount === 0
								? "Empty group"
								: `${memberCount} ${memberCount === 1 ? "account" : "accounts"} · ${previewNames.join(", ")}${previewSuffix}`;

						return (
							<li key={group.id}>
								<button
									type="button"
									className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-base-200 focus:bg-base-200 outline-none"
									onClick={() => setManagingId(group.id)}
								>
									<div className="min-w-0 flex-1">
										<p className="font-medium">{group.name}</p>
										<p className="text-xs text-base-content/60 truncate">{subtitle}</p>
									</div>
									<ChevronRight className="w-4 h-4 text-base-content/40 shrink-0" />
								</button>
							</li>
						);
					})}
				</ul>
			)}

			{creating && (
				<NewGroupModal
					onCancel={() => setCreating(false)}
					onCreated={async () => {
						setCreating(false);
						await refetchGroups();
					}}
				/>
			)}

			{managing && (
				<ManageGroupMembersModal
					group={managing.group}
					accounts={accounts}
					groups={groups}
					onClose={() => setManagingId(null)}
					onChanged={refreshAll}
					onRequestDelete={deleteGroup}
				/>
			)}
		</div>
	);
}
