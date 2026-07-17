import { useState } from "react";
import type { AccountGroup } from "../../utils/accountBalances";
import { NewGroupModal } from "./NewGroupModal";

const CREATE_SENTINEL = "__create__";

type Props = {
	groups: readonly AccountGroup[];
	value: string | null;
	onChange: (groupId: string | null) => void;
	onRefetchGroups: () => Promise<void>;
};

export function GroupPickerField({ groups, value, onChange, onRefetchGroups }: Props) {
	const [showModal, setShowModal] = useState(false);

	return (
		<>
			<label className="floating-label">
				<span>Group (optional)</span>
				<select
					className="select select-bordered w-full"
					value={value ?? ""}
					onChange={async (e) => {
						const v = e.target.value;
						if (v === CREATE_SENTINEL) {
							setShowModal(true);
							return;
						}
						onChange(v === "" ? null : v);
					}}
				>
					<option value="">None</option>
					{groups.map((g) => (
						<option key={g.id} value={g.id}>
							{g.name}
						</option>
					))}
					<option value={CREATE_SENTINEL}>+ Create new group</option>
				</select>
			</label>
			{showModal && (
				<NewGroupModal
					onCancel={() => setShowModal(false)}
					onCreated={async (id) => {
						await onRefetchGroups();
						onChange(id);
						setShowModal(false);
					}}
				/>
			)}
		</>
	);
}
