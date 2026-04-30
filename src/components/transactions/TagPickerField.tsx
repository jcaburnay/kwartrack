import { useMemo, useState } from "react";
import type { Tag, TagScope } from "../../hooks/useTags";
import type { TransactionType } from "../../utils/transactionValidation";
import { NewTagModal } from "./NewTagModal";

const CREATE_SENTINEL = "__create__";

type Props = {
	tags: readonly Tag[];
	transactionType: TransactionType;
	value: string | null;
	onChange: (tagId: string | null) => void;
	createInline: (name: string, type: Exclude<TagScope, "any">) => Promise<Tag | null>;
	required: boolean;
	errorMessage?: string;
};

export function TagPickerField({
	tags,
	transactionType,
	value,
	onChange,
	createInline,
	required,
	errorMessage,
}: Props) {
	const [showCreate, setShowCreate] = useState(false);

	// Scope: expense/income → filter to that scope AND hide system tags.
	// Transfer → show all user tags regardless of scope; system tags still hidden.
	const options = useMemo(() => {
		return tags.filter((t) => {
			if (t.is_system) return false;
			if (transactionType === "transfer") return true;
			return t.type === transactionType;
		});
	}, [tags, transactionType]);

	// The scope used when creating a new tag from this picker.
	const createScope: Exclude<TagScope, "any"> =
		transactionType === "transfer" ? "transfer" : transactionType;

	const labelText = `Tag${transactionType === "transfer" ? " (optional)" : ""}`;

	return (
		<div>
			<label className="floating-label">
				<span>{labelText}</span>
				<select
					className="select select-bordered w-full"
					value={value ?? ""}
					onChange={(e) => {
						const v = e.target.value;
						if (v === CREATE_SENTINEL) {
							setShowCreate(true);
							return;
						}
						onChange(v === "" ? null : v);
					}}
				>
					<option value="" disabled={required}>
						{required ? "Select a tag…" : "None"}
					</option>
					{options.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
					<option value={CREATE_SENTINEL}>+ Create new tag</option>
				</select>
			</label>
			{errorMessage && <p className="mt-1 text-xs text-error">{errorMessage}</p>}
			{showCreate && (
				<NewTagModal
					scope={createScope}
					create={createInline}
					onCreated={(tag) => {
						setShowCreate(false);
						onChange(tag.id);
					}}
					onCancel={() => setShowCreate(false)}
				/>
			)}
		</div>
	);
}
