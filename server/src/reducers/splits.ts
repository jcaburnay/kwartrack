import { SenderError, t } from "spacetimedb/server";
import {
	applyBalance,
	cascadeDeleteDebt,
	isAuthorized,
	resolveOwner,
	validateSplitInput,
} from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// SPLIT REDUCERS
// =============================================================================

// create_split: records a shared expense. Creates expense transaction for full amount,
// then one loaned debt + participant row per person using client-computed shares.
// splitMethod: "equal" | "exact" | "percentage" | "shares"
// participantNames[i] + participantShares[i] + participantShareCounts[i] correspond to the same participant.
export const create_split = spacetimedb.reducer(
	{
		description: t.string(),
		totalAmountCentavos: t.i64(),
		payerSubAccountId: t.u64(),
		tag: t.string(),
		date: t.timestamp(),
		splitMethod: t.string(),
		participantNames: t.array(t.string()),
		participantShares: t.array(t.i64()),
		participantShareCounts: t.array(t.u32()),
	},
	(
		ctx,
		{
			description,
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			splitMethod,
			participantNames,
			participantShares,
			participantShareCounts,
		},
	) => {
		const splitError = validateSplitInput({
			description,
			totalAmountCentavos,
			participantNames,
			participantShares,
			participantShareCounts,
		});
		if (splitError) throw new SenderError(splitError);

		const ownerIdentity = resolveOwner(ctx);

		// Validate and debit payer sub-account (full amount)
		const payerSubAccount = ctx.db.sub_account.id.find(payerSubAccountId);
		if (!payerSubAccount) throw new SenderError("Payer sub-account not found");
		if (!isAuthorized(ctx, payerSubAccount.ownerIdentity)) throw new SenderError("Not authorized");
		ctx.db.sub_account.id.update({
			...payerSubAccount,
			balanceCentavos: applyBalance(payerSubAccount, "debit", totalAmountCentavos),
		});

		// Create expense transaction for the full bill
		ctx.db.transaction.insert({
			id: 0n,
			ownerIdentity,
			type: "expense",
			amountCentavos: totalAmountCentavos,
			tag,
			sourceSubAccountId: payerSubAccountId,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: `Split: ${description.trim()}`,
			date,
			createdAt: ctx.timestamp,
			isRecurring: false,
			recurringDefinitionId: 0n,
			// The split's main expense is the shared bill, not a per-debt transaction.
			// Leaving debtId unset means delete_debt on any participant won't touch it.
			debtId: undefined,
		});

		// Insert split_event
		const splitRow = ctx.db.split_event.insert({
			id: 0n,
			ownerIdentity,
			description: description.trim(),
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			createdAt: ctx.timestamp,
			splitMethod,
		});

		// Create one loaned debt + participant row per person using provided shares
		for (let i = 0; i < participantNames.length; i++) {
			const trimmedName = participantNames[i].trim();
			if (!trimmedName) continue;
			const shareAmount = participantShares[i];
			const shareCount = participantShareCounts[i];

			const debtRow = ctx.db.debt.insert({
				id: 0n,
				ownerIdentity,
				personName: trimmedName,
				direction: "loaned",
				amountCentavos: shareAmount,
				subAccountId: payerSubAccountId,
				settledAmountCentavos: 0n,
				tag,
				description: description.trim(),
				date,
				splitEventId: splitRow.id,
				createdAt: ctx.timestamp,
			});

			ctx.db.split_participant.insert({
				id: 0n,
				ownerIdentity,
				splitEventId: splitRow.id,
				personName: trimmedName,
				shareAmountCentavos: shareAmount,
				debtId: debtRow.id,
				shareCount,
			});
		}
	},
);

// delete_split: removes split_event and participants. Linked debts remain as independent records.
export const delete_split = spacetimedb.reducer(
	{ splitEventId: t.u64() },
	(ctx, { splitEventId }) => {
		const existing = ctx.db.split_event.id.find(splitEventId);
		if (!existing) throw new SenderError("Split not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// Delete all participant rows for this split
		for (const p of ctx.db.split_participant.split_participant_event.filter(splitEventId)) {
			ctx.db.split_participant.id.delete(p.id);
		}

		ctx.db.split_event.id.delete(splitEventId);
	},
);

// edit_split: updates split metadata and reconciles participants.
// Always reverses old payer debit and applies new payer debit, regardless of whether total or payer changed.
// When both are unchanged, this is a net-zero no-op on the same account.
// participantIds[i] = 0n → new participant; >0n → update existing split_participant.id.
// Participants absent from participantIds are removed (split_participant + linked debt deleted).
// settledAmountCentavos is never touched — preserved on existing debts.
// Note: the original expense transaction (description "Split: ...") is not updated here —
// it reflects the original bill amount and is frozen at creation time.
export const edit_split = spacetimedb.reducer(
	{
		splitEventId: t.u64(),
		description: t.string(),
		totalAmountCentavos: t.i64(),
		payerSubAccountId: t.u64(),
		tag: t.string(),
		date: t.timestamp(),
		splitMethod: t.string(),
		participantIds: t.array(t.u64()),
		participantNames: t.array(t.string()),
		participantShares: t.array(t.i64()),
		participantShareCounts: t.array(t.u32()),
	},
	(
		ctx,
		{
			splitEventId,
			description,
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			splitMethod,
			participantIds,
			participantNames,
			participantShares,
			participantShareCounts,
		},
	) => {
		const existing = ctx.db.split_event.id.find(splitEventId);
		if (!existing) throw new SenderError("Split not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		const splitError = validateSplitInput({
			description,
			totalAmountCentavos,
			participantNames,
			participantShares,
			participantShareCounts,
		});
		if (splitError) throw new SenderError(splitError);
		// edit_split also has participantIds; its length must track the other arrays.
		if (participantIds.length !== participantNames.length)
			throw new SenderError("Participant arrays must have the same length");

		const ownerIdentity = resolveOwner(ctx);

		// --- Always reverse old payer debit and apply new payer debit ---
		const oldPayerSubAccount = ctx.db.sub_account.id.find(existing.payerSubAccountId);
		if (!oldPayerSubAccount) throw new SenderError("Old payer sub-account not found");
		if (!isAuthorized(ctx, oldPayerSubAccount.ownerIdentity))
			throw new SenderError("Not authorized");
		ctx.db.sub_account.id.update({
			...oldPayerSubAccount,
			balanceCentavos: applyBalance(oldPayerSubAccount, "credit", existing.totalAmountCentavos),
		});

		const newPayerSubAccount = ctx.db.sub_account.id.find(payerSubAccountId);
		if (!newPayerSubAccount) throw new SenderError("Payer sub-account not found");
		if (!isAuthorized(ctx, newPayerSubAccount.ownerIdentity))
			throw new SenderError("Not authorized");
		ctx.db.sub_account.id.update({
			...newPayerSubAccount,
			balanceCentavos: applyBalance(newPayerSubAccount, "debit", totalAmountCentavos),
		});

		// --- Update split_event ---
		ctx.db.split_event.id.update({
			...existing,
			description: description.trim(),
			totalAmountCentavos,
			payerSubAccountId,
			tag,
			date,
			splitMethod,
		});

		// --- Build lookup set of participant IDs to keep ---
		const keepIds = new Set(participantIds.filter((id) => id !== 0n));

		// --- Remove participants not in the new list ---
		// cascadeDeleteDebt also removes any settlement transactions stamped with the
		// debt's id, so removing a participant mid-edit doesn't leave orphaned txns.
		for (const p of ctx.db.split_participant.split_participant_event.filter(splitEventId)) {
			if (!keepIds.has(p.id)) {
				ctx.db.split_participant.id.delete(p.id);
				const debtRow = ctx.db.debt.id.find(p.debtId);
				if (debtRow) cascadeDeleteDebt(ctx, debtRow);
			}
		}

		// --- Update existing + insert new participants ---
		for (let i = 0; i < participantIds.length; i++) {
			const pid = participantIds[i];
			const trimmedName = participantNames[i].trim();
			if (!trimmedName) continue;
			const shareAmount = participantShares[i];
			const shareCount = participantShareCounts[i];

			if (pid === 0n) {
				// New participant
				const debtRow = ctx.db.debt.insert({
					id: 0n,
					ownerIdentity,
					personName: trimmedName,
					direction: "loaned",
					amountCentavos: shareAmount,
					subAccountId: payerSubAccountId,
					settledAmountCentavos: 0n,
					tag,
					description: description.trim(),
					date,
					splitEventId,
					createdAt: ctx.timestamp,
				});
				ctx.db.split_participant.insert({
					id: 0n,
					ownerIdentity,
					splitEventId,
					personName: trimmedName,
					shareAmountCentavos: shareAmount,
					debtId: debtRow.id,
					shareCount,
				});
			} else {
				// Update existing participant
				const existingP = ctx.db.split_participant.id.find(pid);
				if (!existingP) continue;
				ctx.db.split_participant.id.update({
					...existingP,
					personName: trimmedName,
					shareAmountCentavos: shareAmount,
					shareCount,
				});
				// Update the linked debt amount (preserve settledAmountCentavos)
				const existingDebt = ctx.db.debt.id.find(existingP.debtId);
				if (existingDebt) {
					ctx.db.debt.id.update({
						...existingDebt,
						personName: trimmedName,
						amountCentavos: shareAmount,
						tag,
						description: description.trim(),
						date,
					});
				}
			}
		}
	},
);
