import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { ManageGroupMembersModal } from "../components/accounts/ManageGroupMembersModal";
import { NewGroupModal } from "../components/accounts/NewGroupModal";
import { SettingsSection } from "../components/settings/SettingsSection";
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

	const groupsWithMembers = groups.map((g) => ({
		group: g,
		members: accounts.filter((a) => a.group_id === g.id && !a.is_archived),
	}));

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
		<SettingsSection
			title="Groups"
			description='Bucket accounts by institution (e.g. "Maya" grouping all Maya balances). An account belongs to at most one group. Click a group to manage its accounts.'
			action={
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
					Create group
				</button>
			}
		>
			{error && <div className="alert alert-error text-sm">{error}</div>}

			{isLoading ? (
				<div className="flex justify-center py-6">
					<span className="loading loading-spinner text-primary" />
				</div>
			) : groupsWithMembers.length === 0 ? (
				<div className="border border-dashed border-base-300 rounded-box p-8 text-center text-sm text-base-content/60">
					No groups yet. Bucket accounts to summarise totals together.
				</div>
			) : (
				<ul className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100">
					{groupsWithMembers.map(({ group, members }) => {
						const memberCount = members.length;
						const previewMembers = members.slice(0, 3);
						const overflow = memberCount - previewMembers.length;

						return (
							<li key={group.id}>
								<button
									type="button"
									className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-base-200/60 focus:bg-base-200/60 outline-none transition-colors"
									onClick={() => setManagingId(group.id)}
								>
									<div className="min-w-0 flex-1 flex flex-col gap-1.5">
										<p className="text-sm font-medium truncate">{group.name}</p>
										{memberCount === 0 ? (
											<span className="text-xs text-base-content/50">No accounts yet</span>
										) : (
											<div className="flex flex-wrap items-center gap-1">
												{previewMembers.map((a) => (
													<span
														key={a.id}
														className="badge badge-ghost badge-sm font-normal max-w-[10rem] truncate"
													>
														{a.name}
													</span>
												))}
												{overflow > 0 && (
													<span className="badge badge-ghost badge-sm font-normal text-base-content/60">
														+{overflow}
													</span>
												)}
											</div>
										)}
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
		</SettingsSection>
	);
}
