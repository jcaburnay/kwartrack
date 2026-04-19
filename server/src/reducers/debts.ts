import { SenderError, t } from "spacetimedb/server";
import {
	applyBalance,
	cascadeDeleteDebt,
	isAuthorized,
	resolveOwner,
	validateDebtSettlement,
} from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// DEBT REDUCERS
// =============================================================================

// create_debt: records a new debt and the corresponding cash movement.
// Loaned → debit source sub-account + expense transaction.
// Owed → credit destination sub-account + income transaction.
// The created transaction is stamped with debtId so delete_debt can cascade.
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

		const subAccount = ctx.db.sub_account.id.find(subAccountId);
		if (!subAccount) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, subAccount.ownerIdentity)) throw new SenderError("Not authorized");

		// Insert debt first so we can stamp debtRow.id on the linked transaction.
		const debtRow = ctx.db.debt.insert({
			id: 0n,
			ownerIdentity,
			personName: personName.trim(),
			direction,
			amountCentavos,
			subAccountId,
			settledAmountCentavos: 0n,
			tag,
			description: description.trim(),
			date,
			splitEventId: 0n,
			createdAt: ctx.timestamp,
		});

		if (direction === "loaned") {
			// Debit source sub-account (money going out to the person)
			ctx.db.sub_account.id.update({
				...subAccount,
				balanceCentavos: applyBalance(subAccount, "debit", amountCentavos),
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
				debtId: debtRow.id,
			});
		} else {
			// Credit destination sub-account (money coming in from the person)
			ctx.db.sub_account.id.update({
				...subAccount,
				balanceCentavos: applyBalance(subAccount, "credit", amountCentavos),
			});

			// Create income transaction to record the inflow
			ctx.db.transaction.insert({
				id: 0n,
				ownerIdentity,
				type: "income",
				amountCentavos,
				tag,
				sourceSubAccountId: 0n,
				destinationSubAccountId: subAccountId,
				serviceFeeCentavos: 0n,
				description: `Borrowed from ${personName.trim()}${description ? `: ${description}` : ""}`,
				date,
				createdAt: ctx.timestamp,
				isRecurring: false,
				recurringDefinitionId: 0n,
				debtId: debtRow.id,
			});
		}
	},
);

// settle_debt: partially or fully settle a debt. Creates real transaction + updates settled amount.
// Loaned settlement → income (money coming back). Owed settlement → expense (you're paying them).
// Settlement transactions are stamped with debtId so delete_debt cascades to them too.
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
				debtId: existing.id,
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
				debtId: existing.id,
			});
		}

		ctx.db.debt.id.update({
			...existing,
			settledAmountCentavos: existing.settledAmountCentavos + amountCentavos,
		});
	},
);

// delete_debt: remove the debt + every transaction stamped with its debtId,
// reversing each transaction's balance impact on its sub-account.
// Debts created before the debtId column existed have no matching transactions,
// so they degrade to a plain debt-row delete (matches pre-cascade behavior).
export const delete_debt = spacetimedb.reducer({ debtId: t.u64() }, (ctx, { debtId }) => {
	const existing = ctx.db.debt.id.find(debtId);
	if (!existing) throw new SenderError("Debt not found");
	if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
	cascadeDeleteDebt(ctx, existing);
});
