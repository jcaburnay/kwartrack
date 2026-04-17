import { SenderError, t } from "spacetimedb/server";
import { applyBalance, isAuthorized, resolveOwner, validateDebtSettlement } from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// DEBT REDUCERS
// =============================================================================

// create_debt: records a new debt. Loaned debts debit the source sub-account immediately.
// Owed debts are tracking-only (no balance impact until settled).
export const create_debt = spacetimedb.reducer(
	{
		personName: t.string(),
		direction: t.string(),
		amountCentavos: t.i64(),
		subAccountId: t.u64(),
		tag: t.string(),
		description: t.string(),
		date: t.timestamp(),
	},
	(ctx, { personName, direction, amountCentavos, subAccountId, tag, description, date }) => {
		if (!personName.trim()) throw new SenderError("Person name is required");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (direction !== "loaned" && direction !== "owed")
			throw new SenderError("Direction must be 'loaned' or 'owed'");

		const ownerIdentity = resolveOwner(ctx);

		if (direction === "loaned") {
			// Debit source sub-account (money going out to the person)
			const source = ctx.db.sub_account.id.find(subAccountId);
			if (!source) throw new SenderError("Source sub-account not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.sub_account.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", amountCentavos),
			});

			// Create expense transaction to record the outflow
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "expense",
				amountCentavos,
				tag,
				sourceSubAccountId: subAccountId,
				destinationSubAccountId: 0n,
				serviceFeeCentavos: 0n,
				description: `Loaned to ${personName.trim()}${description ? `: ${description}` : ""}`,
				date,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		}

		ctx.db.debt.insert({
			id: 0n,
			ownerIdentity,
			personName: personName.trim(),
			direction,
			amountCentavos,
			subAccountId: direction === "loaned" ? subAccountId : 0n,
			settledAmountCentavos: 0n,
			tag,
			description: description.trim(),
			date,
			splitEventId: 0n,
			createdAt: ctx.timestamp,
		});
	},
);

// settle_debt: partially or fully settle a debt. Creates real transaction + updates settled amount.
// Loaned settlement → income (money coming back). Owed settlement → expense (you're paying them).
export const settle_debt = spacetimedb.reducer(
	{
		debtId: t.u64(),
		amountCentavos: t.i64(),
		subAccountId: t.u64(),
	},
	(ctx, { debtId, amountCentavos, subAccountId }) => {
		const existing = ctx.db.debt.id.find(debtId);
		if (!existing) throw new SenderError("Debt not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		const settlementError = validateDebtSettlement(existing, amountCentavos);
		if (settlementError) throw new SenderError(settlementError);

		const ownerIdentity = resolveOwner(ctx);
		const subAccountRow = ctx.db.sub_account.id.find(subAccountId);
		if (!subAccountRow) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, subAccountRow.ownerIdentity)) throw new SenderError("Not authorized");

		if (existing.direction === "loaned") {
			// Money coming back to you → income transaction, credit the sub-account
			ctx.db.sub_account.id.update({
				...subAccountRow,
				balanceCentavos: applyBalance(subAccountRow, "credit", amountCentavos),
			});
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "income",
				amountCentavos,
				tag: existing.tag,
				sourceSubAccountId: 0n,
				destinationSubAccountId: subAccountId,
				serviceFeeCentavos: 0n,
				description: `Settlement from ${existing.personName}`,
				date: ctx.timestamp,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		} else {
			// You're paying them → expense transaction, debit the sub-account
			ctx.db.sub_account.id.update({
				...subAccountRow,
				balanceCentavos: applyBalance(subAccountRow, "debit", amountCentavos),
			});
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "expense",
				amountCentavos,
				tag: existing.tag,
				sourceSubAccountId: subAccountId,
				destinationSubAccountId: 0n,
				serviceFeeCentavos: 0n,
				description: `Settlement to ${existing.personName}`,
				date: ctx.timestamp,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
			});
		}

		ctx.db.debt.id.update({
			...existing,
			settledAmountCentavos: existing.settledAmountCentavos + amountCentavos,
		});
	},
);

// delete_debt: removes a debt record. Does NOT reverse linked transactions.
export const delete_debt = spacetimedb.reducer({ debtId: t.u64() }, (ctx, { debtId }) => {
	const existing = ctx.db.debt.id.find(debtId);
	if (!existing) throw new SenderError("Debt not found");
	if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
	ctx.db.debt.id.delete(debtId);
});
