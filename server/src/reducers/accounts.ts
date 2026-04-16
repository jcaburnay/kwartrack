import { SenderError, t } from "spacetimedb/server";
import { isAuthorized, resolveOwner } from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// ACCOUNT REDUCERS
// =============================================================================

// create_account
// Client: conn.reducers.createAccount({ name: 'Maya', initialBalanceCentavos: 12050000n })
// If initialBalanceCentavos > 0n => isStandalone=true, hidden default sub-account auto-created (D-04)
// If initialBalanceCentavos === 0n => isStandalone=false, no sub-accounts created
export const create_account = spacetimedb.reducer(
	{ name: t.string(), initialBalanceCentavos: t.i64(), iconBankId: t.string().optional() },
	(ctx, { name, initialBalanceCentavos, iconBankId }) => {
		if (!name.trim()) throw new SenderError("Account name is required");

		const ownerIdentity = resolveOwner(ctx);
		const isStandalone = initialBalanceCentavos > 0n;
		const accountRow = ctx.db.account.insert({
			id: 0n,
			ownerIdentity,
			name: name.trim(),
			isStandalone,
			iconBankId,
			createdAt: ctx.timestamp,
		});

		if (isStandalone) {
			// Hidden default sub-account stores the initial balance (D-04)
			ctx.db.sub_account.insert({
				id: 0n,
				accountId: accountRow.id,
				ownerIdentity,
				name: "__default__",
				balanceCentavos: initialBalanceCentavos,
				isDefault: true,
				createdAt: ctx.timestamp,
				subAccountType: "wallet",
				creditLimitCentavos: 0n,
			});
		}
	},
);

// rename_account
// Client: conn.reducers.renameAccount({ accountId: 1n, newName: 'Maya GCash' })
export const rename_account = spacetimedb.reducer(
	{ accountId: t.u64(), newName: t.string() },
	(ctx, { accountId, newName }) => {
		if (!newName.trim()) throw new SenderError("Account name is required");
		const existing = ctx.db.account.id.find(accountId);
		if (!existing) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		ctx.db.account.id.update({ ...existing, name: newName.trim() });
	},
);

// update_account_icon
// Client: conn.reducers.updateAccountIcon({ accountId: 1n, iconBankId: 'bdo' })
// Pass iconBankId: undefined to clear the icon.
export const update_account_icon = spacetimedb.reducer(
	{ accountId: t.u64(), iconBankId: t.string().optional() },
	(ctx, { accountId, iconBankId }) => {
		const ownerIdentity = resolveOwner(ctx);
		const existing = ctx.db.account.id.find(accountId);
		if (!existing) throw new SenderError("Account not found");
		if (existing.ownerIdentity.toHexString() !== ownerIdentity.toHexString()) {
			throw new SenderError("Not authorized");
		}
		ctx.db.account.id.update({ ...existing, iconBankId });
	},
);

// delete_account
// Client: conn.reducers.deleteAccount({ accountId: 1n })
// Cascades: deletes all sub-accounts (including hidden default sub-account) first (D-15)
export const delete_account = spacetimedb.reducer({ accountId: t.u64() }, (ctx, { accountId }) => {
	const existing = ctx.db.account.id.find(accountId);
	if (!existing) throw new SenderError("Account not found");
	if (!isAuthorized(ctx, existing.ownerIdentity)) {
		throw new SenderError("Not authorized");
	}
	for (const sa of ctx.db.sub_account.sub_account_account.filter(accountId)) {
		ctx.db.sub_account.id.delete(sa.id);
	}
	ctx.db.account.id.delete(accountId);
});
