import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Account } from "../../utils/accountBalances";
import {
	daysToMaturity,
	estimatedTimeDepositValue,
	interestAccrued,
} from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";

type Props = {
	account: Account;
	onWithdrawMatured?: () => void;
};

type ReconciliationStatus =
	| { accountId: string; kind: "loading" }
	| { accountId: string; kind: "error" }
	| {
			accountId: string;
			kind: "ready";
			needsReconciliation: boolean;
			reconciliationCutover: string | null;
			saving: boolean;
			saveError: string | null;
	  };

function formatRate(bps: number): string {
	return `${(bps / 100).toFixed(2)}% p.a.`;
}

function formatInterval(i: Account["interest_posting_interval"]): string {
	switch (i) {
		case "monthly":
			return "Posts monthly";
		case "quarterly":
			return "Posts quarterly";
		case "semi-annual":
			return "Posts semi-annually";
		case "annual":
			return "Posts annually";
		case "at-maturity":
			return "Posts at maturity";
		default:
			return "—";
	}
}

export function TimeDepositStrip({ account, onWithdrawMatured }: Props) {
	const [reconciliation, setReconciliation] = useState<ReconciliationStatus | null>(null);
	const requestVersion = useRef(0);
	const monthly =
		account.type === "time-deposit" && account.interest_posting_interval === "monthly";

	const loadReconciliation = useCallback(async (accountId: string) => {
		const request = ++requestVersion.current;
		setReconciliation({ accountId, kind: "loading" });
		const { data, error } = await supabase
			.from("td_monthly_interest_state")
			.select("needs_reconciliation, reconciliation_cutover")
			.eq("account_id", accountId)
			.maybeSingle();
		if (request !== requestVersion.current) return;
		setReconciliation(
			error
				? { accountId, kind: "error" }
				: {
						accountId,
						kind: "ready",
						needsReconciliation: data?.needs_reconciliation ?? false,
						reconciliationCutover: data?.reconciliation_cutover ?? null,
						saving: false,
						saveError: null,
					},
		);
	}, []);

	useEffect(() => {
		if (monthly) void loadReconciliation(account.id);
		return () => {
			requestVersion.current++;
		};
	}, [account.id, monthly, loadReconciliation]);

	async function markReviewed() {
		const accountId = account.id;
		const request = requestVersion.current;
		setReconciliation((current) =>
			current?.accountId === accountId && current.kind === "ready"
				? { ...current, saving: true, saveError: null }
				: current,
		);
		const { error } = await supabase.rpc("td_confirm_interest_reconciliation", {
			p_account_id: accountId,
		});
		if (request !== requestVersion.current) return;
		setReconciliation((current) =>
			current?.accountId === accountId && current.kind === "ready"
				? {
						...current,
						saving: false,
						needsReconciliation: error ? current.needsReconciliation : false,
						saveError: error?.message ?? null,
					}
				: current,
		);
	}

	if (account.type !== "time-deposit") return null;
	const visibleReconciliation =
		monthly && reconciliation?.accountId === account.id ? reconciliation : null;
	const accrued = interestAccrued(account) ?? 0;
	const days = daysToMaturity(account) ?? 0;
	const estimate = estimatedTimeDepositValue(account);

	return (
		<div className="flex flex-col gap-3">
			<div>
				<p className="text-3xl font-semibold tabular-nums">
					{formatCentavos(account.balance_centavos)}
				</p>
				<p className="text-xs text-success mt-0.5">+{formatCentavos(accrued)} accrued</p>
			</div>

			<dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Principal</dt>
					<dd className="tabular-nums">{formatCentavos(account.principal_centavos ?? 0)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Rate</dt>
					<dd className="tabular-nums">{formatRate(account.interest_rate_bps ?? 0)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Cadence</dt>
					<dd>{formatInterval(account.interest_posting_interval)}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-base-content/60">Days to mat.</dt>
					<dd className="tabular-nums">{days > 0 ? days : "—"}</dd>
				</div>
				<div className="flex items-center justify-between gap-3 col-span-2">
					<dt className="text-base-content/60">Maturity</dt>
					<dd className="tabular-nums">{account.maturity_date ?? "—"}</dd>
				</div>
				{estimate != null && (
					<div className="flex items-center justify-between gap-3 col-span-2">
						<dt className="text-base-content/60">Estimated</dt>
						<dd className="tabular-nums text-base-content/80">{formatCentavos(estimate)}</dd>
					</div>
				)}
			</dl>

			{monthly && !visibleReconciliation && (
				<p role="status" className="text-xs text-base-content/60">
					Checking interest history…
				</p>
			)}
			{visibleReconciliation?.kind === "loading" && (
				<p role="status" className="text-xs text-base-content/60">
					Checking interest history…
				</p>
			)}
			{visibleReconciliation?.kind === "error" && (
				<div className="alert alert-warning text-sm">
					<span>Could not check interest history.</span>
					<button
						type="button"
						className="btn btn-sm"
						onClick={() => void loadReconciliation(account.id)}
					>
						Retry
					</button>
				</div>
			)}
			{visibleReconciliation?.kind === "ready" && visibleReconciliation.needsReconciliation && (
				<div className="alert alert-warning text-sm flex-col items-start gap-2">
					<p>
						Pre-cutover interest may need review against your bank statements.
						{visibleReconciliation.reconciliationCutover &&
							` Check entries before ${visibleReconciliation.reconciliationCutover}.`}{" "}
						If a credit is missing, add it as a normal income transaction.
					</p>
					{visibleReconciliation.saveError && (
						<p role="alert">Could not mark reviewed: {visibleReconciliation.saveError}</p>
					)}
					<button
						type="button"
						className="btn btn-sm"
						disabled={visibleReconciliation.saving}
						onClick={() => void markReviewed()}
					>
						{visibleReconciliation.saving ? "Saving…" : "Mark reviewed"}
					</button>
				</div>
			)}

			{account.is_matured && onWithdrawMatured && (
				<div className="flex justify-end">
					<button type="button" className="btn btn-sm btn-primary" onClick={onWithdrawMatured}>
						Withdraw matured balance
					</button>
				</div>
			)}
		</div>
	);
}
