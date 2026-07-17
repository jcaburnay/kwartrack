import { Download } from "lucide-react";
import { useState } from "react";
import { SettingsSection } from "../components/settings/SettingsSection";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import {
	ENTITY_KEYS,
	ENTITY_LABELS,
	type EntityKey,
	exportEntityCsv,
	exportFullJson,
} from "../utils/dataExport";

export function SettingsExportPage() {
	const { user } = useAuth();
	const [jsonState, setJsonState] = useState<"idle" | "running" | "error">("idle");
	const [jsonError, setJsonError] = useState<string | null>(null);

	const [entity, setEntity] = useState<EntityKey>("transaction");
	const [csvState, setCsvState] = useState<"idle" | "running" | "error">("idle");
	const [csvError, setCsvError] = useState<string | null>(null);

	if (!user) {
		return (
			<div className="flex justify-center py-10">
				<span className="loading loading-spinner text-primary" />
			</div>
		);
	}

	async function downloadJson() {
		if (!user) return;
		setJsonState("running");
		setJsonError(null);
		try {
			await exportFullJson(supabase, user.id);
			setJsonState("idle");
		} catch (e) {
			setJsonError(e instanceof Error ? e.message : "Export failed.");
			setJsonState("error");
		}
	}

	async function downloadCsv() {
		if (!user) return;
		setCsvState("running");
		setCsvError(null);
		try {
			await exportEntityCsv(supabase, user.id, entity);
			setCsvState("idle");
		} catch (e) {
			setCsvError(e instanceof Error ? e.message : "Export failed.");
			setCsvState("error");
		}
	}

	return (
		<SettingsSection
			title="Data export"
			description="Export your data as a portable backup or for ad-hoc analysis. All amounts are integer centavos; timestamps are ISO-8601 with timezone offsets."
		>
			<div className="flex flex-col gap-4">
				{/* Full backup */}
				<div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div className="flex flex-col gap-1 max-w-prose">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium">Full backup</span>
							<span className="badge badge-ghost badge-sm font-normal">JSON</span>
						</div>
						<p className="text-sm text-base-content/60">
							A single readable file containing every entity you own — accounts, transactions,
							recurrings, budgets, debts, splits, contacts, and tags. Intended as a safety-valve
							backup, not a re-import path.
						</p>
						{jsonError && <p className="text-xs text-error">{jsonError}</p>}
					</div>
					<button
						type="button"
						className="btn btn-primary btn-sm shrink-0"
						onClick={downloadJson}
						disabled={jsonState === "running"}
					>
						<Download className="size-4" aria-hidden />
						{jsonState === "running" ? "Building…" : "Download backup"}
					</button>
				</div>

				{/* Per-entity CSV */}
				<div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5 flex flex-col gap-3">
					<div className="flex flex-col gap-1 max-w-prose">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium">Per-entity export</span>
							<span className="badge badge-ghost badge-sm font-normal">CSV</span>
						</div>
						<p className="text-sm text-base-content/60">
							Pick any entity and download a flat CSV — handy for pasting into a spreadsheet for
							ad-hoc analysis.
						</p>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
						<div className="flex flex-col gap-1 sm:flex-1 sm:max-w-xs">
							<label htmlFor="export-entity" className="text-xs font-medium">
								Entity
							</label>
							<select
								id="export-entity"
								className="select select-bordered select-sm w-full"
								value={entity}
								onChange={(e) => setEntity(e.target.value as EntityKey)}
							>
								{ENTITY_KEYS.map((k) => (
									<option key={k} value={k}>
										{ENTITY_LABELS[k]}
									</option>
								))}
							</select>
						</div>
						<button
							type="button"
							className="btn btn-primary btn-sm shrink-0"
							onClick={downloadCsv}
							disabled={csvState === "running"}
						>
							<Download className="size-4" aria-hidden />
							{csvState === "running" ? "Building…" : "Download CSV"}
						</button>
					</div>
					{csvError && <p className="text-xs text-error">{csvError}</p>}
				</div>
			</div>
		</SettingsSection>
	);
}
