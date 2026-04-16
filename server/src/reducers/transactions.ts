import { SenderError, t } from "spacetimedb/server";
import { applyBalance, isAuthorized, resolveOwner } from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// TRANSACTION REDUCERS
// D-22 balance update formulas:
//   Expense:  source.balanceCentavos -= (amountCentavos + serviceFeeCentavos)
//   Income:   destination.balanceCentavos += amountCentavos
//   Transfer: source -= (amount + serviceFee), destination += amount
// =============================================================================

export const create_transaction = spacetimedb.reducer(
	{
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		sourceSubAccountId: t.u64(),
		destinationSubAccountId: t.u64(),
		serviceFeeCentavos: t.i64(),
		description: t.string(),
		date: t.timestamp(),
	},
	(
		ctx,
		{
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
		},
	) => {
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");
		if (!tag.trim()) throw new SenderError("Tag is required");

		const ownerIdentity = resolveOwner(ctx);

		// Validate and update source sub-account (expense, transfer)
		if (type === "expense" || type === "transfer") {
			const source = ctx.db.sub_account.id.find(sourceSubAccountId);
			if (!source) throw new SenderError("Source sub-account not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			const debit = amountCentavos + serviceFeeCentavos;
			ctx.db.sub_account.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", debit),
			});
		}

		// Validate and update destination sub-account (income, transfer)
		if (type === "income" || type === "transfer") {
			const destination = ctx.db.sub_account.id.find(destinationSubAccountId);
			if (!destination) throw new SenderError("Destination sub-account not found");
			if (!isAuthorized(ctx, destination.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.sub_account.id.update({
				...destination,
				balanceCentavos: applyBalance(destination, "credit", amountCentavos),
			});
		}

		ctx.db.transaction.insert({
			id: 0n,
			ownerIdentity,
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
			createdAt: ctx.timestamp,
			isRecurring: false, // manually created transactions are never recurring
			recurringDefinitionId: 0n, // 0n sentinel for non-recurring (D-10)
		});
	},
);

export const edit_transaction = spacetimedb.reducer(
	{
		transactionId: t.u64(),
		type: t.string(),
		amountCentavos: t.i64(),
		tag: t.string(),
		sourceSubAccountId: t.u64(),
		destinationSubAccountId: t.u64(),
		serviceFeeCentavos: t.i64(),
		description: t.string(),
		date: t.timestamp(),
	},
	(
		ctx,
		{
			transactionId,
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
		},
	) => {
		const existing = ctx.db.transaction.id.find(transactionId);
		if (!existing) throw new SenderError("Transaction not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (amountCentavos <= 0n) throw new SenderError("Amount must be greater than 0");

		// --- Reverse old transaction's balance effect ---
		if (existing.type === "expense" || existing.type === "transfer") {
			const oldSource = ctx.db.sub_account.id.find(existing.sourceSubAccountId);
			if (oldSource) {
				const oldDebit = existing.amountCentavos + existing.serviceFeeCentavos;
				ctx.db.sub_account.id.update({
					...oldSource,
					balanceCentavos: applyBalance(oldSource, "credit", oldDebit), // reversal = opposite direction
				});
			}
		}
		if (existing.type === "income" || existing.type === "transfer") {
			const oldDest = ctx.db.sub_account.id.find(existing.destinationSubAccountId);
			if (oldDest) {
				ctx.db.sub_account.id.update({
					...oldDest,
					balanceCentavos: applyBalance(oldDest, "debit", existing.amountCentavos), // reversal = opposite direction
				});
			}
		}

		// --- Apply new transaction's balance effect ---
		if (type === "expense" || type === "transfer") {
			const source = ctx.db.sub_account.id.find(sourceSubAccountId);
			if (!source) throw new SenderError("Source sub-account not found");
			if (!isAuthorized(ctx, source.ownerIdentity)) throw new SenderError("Not authorized");
			const debit = amountCentavos + serviceFeeCentavos;
			ctx.db.sub_account.id.update({
				...source,
				balanceCentavos: applyBalance(source, "debit", debit),
			});
		}
		if (type === "income" || type === "transfer") {
			const dest = ctx.db.sub_account.id.find(destinationSubAccountId);
			if (!dest) throw new SenderError("Destination sub-account not found");
			if (!isAuthorized(ctx, dest.ownerIdentity)) throw new SenderError("Not authorized");
			ctx.db.sub_account.id.update({
				...dest,
				balanceCentavos: applyBalance(dest, "credit", amountCentavos),
			});
		}

		ctx.db.transaction.id.update({
			...existing,
			type,
			amountCentavos,
			tag,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
			description,
			date,
		});
	},
);

export const delete_transaction = spacetimedb.reducer(
	{ transactionId: t.u64() },
	(ctx, { transactionId }) => {
		const existing = ctx.db.transaction.id.find(transactionId);
		if (!existing) throw new SenderError("Transaction not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// Reverse balance effect (opposite direction to undo the original transaction)
		if (existing.type === "expense" || existing.type === "transfer") {
			const source = ctx.db.sub_account.id.find(existing.sourceSubAccountId);
			if (source) {
				const debit = existing.amountCentavos + existing.serviceFeeCentavos;
				ctx.db.sub_account.id.update({
					...source,
					balanceCentavos: applyBalance(source, "credit", debit), // undo the debit
				});
			}
		}
		if (existing.type === "income" || existing.type === "transfer") {
			const dest = ctx.db.sub_account.id.find(existing.destinationSubAccountId);
			if (dest) {
				ctx.db.sub_account.id.update({
					...dest,
					balanceCentavos: applyBalance(dest, "debit", existing.amountCentavos), // undo the credit
				});
			}
		}

		ctx.db.transaction.id.delete(transactionId);
	},
);
