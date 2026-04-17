import { ScheduleAt } from "spacetimedb";
import { SenderError, t } from "spacetimedb/server";
import {
	computeFirstFireMicros,
	computeMonthlyNetInterestCentavos,
	isAuthorized,
	nextRecurringDefinitionId,
	resolveOwner,
	validateCreditAccountEdit,
	validateTimeDepositCreation,
} from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// SUB-ACCOUNT REDUCERS
// =============================================================================

// add_sub_account
// Client: conn.reducers.addSubAccount({ accountId: 1n, name: 'Savings', initialBalanceCentavos: 0n, subAccountType: 'savings', creditLimitCentavos: 0n })
// Only for non-standalone accounts. For standalone accounts, use convert_and_create_sub_account.
export const add_sub_account = spacetimedb.reducer(
	{
		accountId: t.u64(),
		name: t.string(),
		initialBalanceCentavos: t.i64(),
		subAccountType: t.string(), // 'wallet' | 'savings' | 'time-deposit' | 'credit'
		creditLimitCentavos: t.i64(),
	},
	(ctx, { accountId, name, initialBalanceCentavos, subAccountType, creditLimitCentavos }) => {
		if (!name.trim()) throw new SenderError("Sub-account name is required");
		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) throw new SenderError("Not authorized");
		if (acc.isStandalone)
			throw new SenderError("Account is standalone — use convert_and_create_sub_account");

		const ownerIdentity = resolveOwner(ctx);

		ctx.db.sub_account.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: name.trim(),
			balanceCentavos: initialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			subAccountType: subAccountType || "wallet",
			creditLimitCentavos: creditLimitCentavos ?? 0n,
		});
	},
);

// convert_and_create_sub_account
// Called when adding the first sub-account to a standalone account.
// Atomically: converts hidden default sub-account → visible (or deletes if balance=0),
// marks account as non-standalone, and inserts the new sub-account.
// Client: conn.reducers.convertAndCreateSubAccount({ accountId: 1n, newName: 'Savings', newSubAccountType: 'savings', newCreditLimitCentavos: 0n, existingName: 'Main', existingSubAccountType: 'wallet' })
export const convert_and_create_sub_account = spacetimedb.reducer(
	{
		accountId: t.u64(),
		newName: t.string(),
		newSubAccountType: t.string(),
		newCreditLimitCentavos: t.i64(),
		newSubAccountInitialBalanceCentavos: t.i64(),
		existingName: t.string(),
		existingSubAccountType: t.string(),
	},
	(
		ctx,
		{
			accountId,
			newName,
			newSubAccountType,
			newCreditLimitCentavos,
			newSubAccountInitialBalanceCentavos,
			existingName,
			existingSubAccountType,
		},
	) => {
		if (!newName.trim()) throw new SenderError("Sub-account name is required");
		if (existingSubAccountType === "credit")
			throw new SenderError("Cannot convert default sub-account to credit type");
		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) throw new SenderError("Not authorized");
		if (!acc.isStandalone) throw new SenderError("Account is not standalone");

		const ownerIdentity = resolveOwner(ctx);

		// Find the hidden default sub-account ID via index, then fetch full row for update
		let defaultSubAccountId: bigint | undefined;
		for (const sa of ctx.db.sub_account.sub_account_account.filter(accountId)) {
			if (sa.isDefault) {
				defaultSubAccountId = sa.id;
				break;
			}
		}

		if (defaultSubAccountId !== undefined) {
			const defaultSubAccount = ctx.db.sub_account.id.find(defaultSubAccountId);
			if (defaultSubAccount) {
				if (defaultSubAccount.balanceCentavos > 0n) {
					// Convert: make the hidden default visible with the user's chosen name
					ctx.db.sub_account.id.update({
						...defaultSubAccount,
						name: existingName.trim() || "Main",
						isDefault: false,
						subAccountType: existingSubAccountType || "wallet",
					});
				} else {
					// Zero balance: just remove the hidden default
					ctx.db.sub_account.id.delete(defaultSubAccountId);
				}
			}
		}

		// Mark account as no longer standalone
		ctx.db.account.id.update({ ...acc, isStandalone: false });

		// Insert the new sub-account with the user-supplied initial balance
		ctx.db.sub_account.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: newName.trim(),
			balanceCentavos: newSubAccountInitialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			subAccountType: newSubAccountType || "wallet",
			creditLimitCentavos: newSubAccountType === "credit" ? newCreditLimitCentavos : 0n,
		});
	},
);

// rename_sub_account
export const rename_sub_account = spacetimedb.reducer(
	{ subAccountId: t.u64(), newName: t.string() },
	(ctx, { subAccountId, newName }) => {
		if (!newName.trim()) throw new SenderError("Sub-account name is required");
		const existing = ctx.db.sub_account.id.find(subAccountId);
		if (!existing) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		ctx.db.sub_account.id.update({ ...existing, name: newName.trim() });
	},
);

// edit_sub_account — update name, credit limit, and optionally outstanding balance
export const edit_sub_account = spacetimedb.reducer(
	{
		subAccountId: t.u64(),
		newName: t.string(),
		newCreditLimitCentavos: t.i64(),
		newBalanceCentavos: t.i64().optional(),
	},
	(ctx, { subAccountId, newName, newCreditLimitCentavos, newBalanceCentavos }) => {
		if (!newName.trim()) throw new SenderError("Sub-account name is required");
		const existing = ctx.db.sub_account.id.find(subAccountId);
		if (!existing) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");
		if (existing.subAccountType !== "credit")
			throw new SenderError("Only credit sub-accounts can be edited");
		const limitError = validateCreditAccountEdit(newCreditLimitCentavos, newBalanceCentavos);
		if (limitError) throw new SenderError(limitError);
		ctx.db.sub_account.id.update({
			...existing,
			name: newName.trim(),
			creditLimitCentavos: newCreditLimitCentavos,
			...(newBalanceCentavos != null ? { balanceCentavos: newBalanceCentavos } : {}),
		});
	},
);

// delete_sub_account
export const delete_sub_account = spacetimedb.reducer(
	{ subAccountId: t.u64() },
	(ctx, { subAccountId }) => {
		const existing = ctx.db.sub_account.id.find(subAccountId);
		if (!existing) throw new SenderError("Sub-account not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) throw new SenderError("Not authorized");

		// If time deposit: clean up metadata and recurring definition
		const meta = ctx.db.time_deposit_metadata.subAccountId.find(subAccountId);
		if (meta) {
			for (const sched of ctx.db.recurring_transaction_schedule.recurring_schedule_definition_id.filter(
				meta.recurringDefinitionId,
			)) {
				ctx.db.recurring_transaction_schedule.scheduledId.delete(sched.scheduledId);
			}
			ctx.db.recurring_transaction_definition_v2.id.delete(meta.recurringDefinitionId);
			ctx.db.time_deposit_metadata.subAccountId.delete(subAccountId);
		}

		ctx.db.sub_account.id.delete(subAccountId);
	},
);

// create_time_deposit
// Creates a time deposit sub-account + recurring income definition + metadata row atomically.
// Monthly net interest = principal × (interestRateBps / 10_000) / 12 × 0.80
// Integer: (principal × bps × 80n) / 12_000_000n
// Client: conn.reducers.createTimeDeposit({ accountId, name, initialBalanceCentavos, interestRateBps, maturityDate })
export const create_time_deposit = spacetimedb.reducer(
	{
		accountId: t.u64(),
		name: t.string(),
		initialBalanceCentavos: t.i64(),
		interestRateBps: t.u32(),
		maturityDate: t.timestamp(),
	},
	(ctx, { accountId, name, initialBalanceCentavos, interestRateBps, maturityDate }) => {
		if (!name.trim()) throw new SenderError("Sub-account name is required");
		const validationError = validateTimeDepositCreation({
			initialBalanceCentavos,
			interestRateBps,
			maturityDateMicros: maturityDate.microsSinceUnixEpoch,
			nowMicros: ctx.timestamp.microsSinceUnixEpoch,
		});
		if (validationError) throw new SenderError(validationError);

		const acc = ctx.db.account.id.find(accountId);
		if (!acc) throw new SenderError("Account not found");
		if (!isAuthorized(ctx, acc.ownerIdentity)) throw new SenderError("Not authorized");
		if (acc.isStandalone)
			throw new SenderError("Account is standalone — use convert_and_create_sub_account");

		const ownerIdentity = resolveOwner(ctx);

		// 1. Create the sub-account
		const subAccountRow = ctx.db.sub_account.insert({
			id: 0n,
			accountId,
			ownerIdentity,
			name: name.trim(),
			balanceCentavos: initialBalanceCentavos,
			isDefault: false,
			createdAt: ctx.timestamp,
			subAccountType: "time-deposit",
			creditLimitCentavos: 0n,
		});

		// 2. Compute monthly net interest
		const monthlyNetCentavos = computeMonthlyNetInterestCentavos(
			initialBalanceCentavos,
			interestRateBps,
		);
		if (monthlyNetCentavos <= 0n)
			throw new SenderError("Computed monthly interest is zero — check rate and balance");

		// 3. Create recurring income definition (same ID strategy as create_recurring_definition)
		const defRow = ctx.db.recurring_transaction_definition_v2.insert({
			id: nextRecurringDefinitionId(
				ctx.db.recurring_transaction_definition.iter(),
				ctx.db.recurring_transaction_definition_v2.iter(),
			),
			ownerIdentity,
			name: `${name.trim()} — Interest`,
			type: "income",
			amountCentavos: monthlyNetCentavos,
			tag: "interest",
			subAccountId: subAccountRow.id,
			dayOfMonth: 1,
			interval: "monthly",
			anchorMonth: 0,
			anchorDayOfWeek: 0,
			isPaused: false,
			remainingOccurrences: 0,
			totalOccurrences: 0,
			createdAt: ctx.timestamp,
		});

		// 4. Schedule first fire
		const firstFireMicros = computeFirstFireMicros(
			ctx.timestamp.microsSinceUnixEpoch,
			1,
			"monthly",
			0,
			0,
		);
		ctx.db.recurring_transaction_schedule.insert({
			scheduledId: 0n,
			scheduledAt: ScheduleAt.time(firstFireMicros),
			definitionId: defRow.id,
		});

		// 5. Insert metadata row
		ctx.db.time_deposit_metadata.insert({
			subAccountId: subAccountRow.id,
			ownerIdentity,
			interestRateBps,
			maturityDate,
			recurringDefinitionId: defRow.id,
			isMatured: false,
			principalCentavos: initialBalanceCentavos,
			createdAt: ctx.timestamp,
		});
	},
);

// edit_time_deposit_metadata
// Updates interest rate and/or maturity date. Recomputes monthly amount if rate changed.
// Resumes interest posting if maturity extended past now and TD was already matured.
// Client: conn.reducers.editTimeDepositMetadata({ subAccountId, interestRateBps, maturityDate })
export const edit_time_deposit_metadata = spacetimedb.reducer(
	{
		subAccountId: t.u64(),
		interestRateBps: t.u32(),
		maturityDate: t.timestamp(),
	},
	(ctx, { subAccountId, interestRateBps, maturityDate }) => {
		const meta = ctx.db.time_deposit_metadata.subAccountId.find(subAccountId);
		if (!meta) throw new SenderError("Time deposit metadata not found");
		if (!isAuthorized(ctx, meta.ownerIdentity)) throw new SenderError("Not authorized");
		if (interestRateBps === 0) throw new SenderError("Interest rate is required");

		let updatedMeta = { ...meta, maturityDate, interestRateBps };

		// Read def once; accumulate all mutations before writing
		const def = ctx.db.recurring_transaction_definition_v2.id.find(meta.recurringDefinitionId);
		let defUpdate = def ? { ...def } : null;

		// If rate changed, recompute monthly net interest using original principal
		if (interestRateBps !== meta.interestRateBps) {
			const newMonthlyNetCentavos = computeMonthlyNetInterestCentavos(
				meta.principalCentavos,
				interestRateBps,
			);
			if (newMonthlyNetCentavos <= 0n)
				throw new SenderError("Computed monthly interest is zero — check rate and balance");
			if (defUpdate) defUpdate = { ...defUpdate, amountCentavos: newMonthlyNetCentavos };
		}

		// If maturity extended past now and TD was already matured, resume posting
		const nowMicros = ctx.timestamp.microsSinceUnixEpoch;
		if (meta.isMatured && maturityDate.microsSinceUnixEpoch > nowMicros) {
			if (defUpdate?.isPaused) {
				defUpdate = { ...defUpdate, isPaused: false };
				const nextFireMicros = computeFirstFireMicros(nowMicros, 1, "monthly", 0, 0);
				ctx.db.recurring_transaction_schedule.insert({
					scheduledId: 0n,
					scheduledAt: ScheduleAt.time(nextFireMicros),
					definitionId: meta.recurringDefinitionId,
				});
			}
			updatedMeta = { ...updatedMeta, isMatured: false };
		}

		// Single write for recurring definition if it changed
		if (defUpdate && def) {
			ctx.db.recurring_transaction_definition_v2.id.update(defUpdate);
		}

		ctx.db.time_deposit_metadata.subAccountId.update(updatedMeta);
	},
);
