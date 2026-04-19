import { SenderError, t } from "spacetimedb/server";
import {
	type AppCtx,
	applyBalance,
	applyReverseMutation,
	computeTransactionMutations,
	isAuthorized,
	resolveOwner,
	type TransactionMutation,
} from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// TRANSACTION REDUCERS
// D-22 balance update formulas:
//   Expense:  source.balanceCentavos -= (amountCentavos + serviceFeeCentavos)
//   Income:   destination.balanceCentavos += amountCentavos
//   Transfer: source -= (amount + serviceFee), destination += amount
// =============================================================================

// Apply a forward-direction mutation: require the sub-account exist + belong to
// the sender, then write the new balance. Throws SenderError with a role-aware
// message if validation fails.
function applyForwardMutation(ctx: AppCtx, mutation: TransactionMutation): void {
	const subAccount = ctx.db.sub_account.id.find(mutation.subAccountId);
	if (!subAccount) {
		throw new SenderError(
			mutation.role === "source"
				? "Source sub-account not found"
				: "Destination sub-account not found",
		);
	}
	if (!isAuthorized(ctx, subAccount.ownerIdentity)) throw new SenderError("Not authorized");
	ctx.db.sub_account.id.update({
		...subAccount,
		balanceCentavos: applyBalance(subAccount, mutation.direction, mutation.delta),
	});
}

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

		for (const mutation of computeTransactionMutations({
			type,
			amountCentavos,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
		})) {
			applyForwardMutation(ctx, mutation);
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
			debtId: 0n,
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

		// Reverse the old transaction's balance effect…
		for (const mutation of computeTransactionMutations(existing, true)) {
			applyReverseMutation(ctx, mutation);
		}

		// …then apply the new one.
		for (const mutation of computeTransactionMutations({
			type,
			amountCentavos,
			sourceSubAccountId,
			destinationSubAccountId,
			serviceFeeCentavos,
		})) {
			applyForwardMutation(ctx, mutation);
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

		for (const mutation of computeTransactionMutations(existing, true)) {
			applyReverseMutation(ctx, mutation);
		}

		ctx.db.transaction.id.delete(transactionId);
	},
);
