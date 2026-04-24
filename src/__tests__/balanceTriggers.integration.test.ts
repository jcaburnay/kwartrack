/**
 * Integration tests for the two transaction triggers defined in
 * 20260424133300_transactions.sql:
 *   1. apply_transaction_balance_delta — reverses old effect, applies new
 *   2. sync_paired_transfer_fee — keeps a paired 'transfer-fees' expense row
 *      in lockstep with the parent transfer's fee / from_account / date
 *
 * Runs against the local Supabase stack via the service role. Skipped when
 * SUPABASE_SECRET_KEY is not available (e.g. CI without supabase).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const canRun = Boolean(url && secretKey);
const runOrSkip = canRun ? describe : describe.skip;

let admin: SupabaseClient<Database>;
let userId = "";
let cashId = "";
let walletId = "";
let cardId = "";
let foodsTagId = "";
let tenantEmail = "";

async function balanceOf(accountId: string): Promise<number> {
	const { data, error } = await admin
		.from("account")
		.select("balance_centavos")
		.eq("id", accountId)
		.single();
	if (error || !data) throw error ?? new Error("account not found");
	return data.balance_centavos;
}

async function wipeTransactions() {
	// Deleting parents cascades to children via ON DELETE CASCADE, which reverses
	// both balance deltas. Balances return to initial.
	const { error } = await admin
		.from("transaction")
		.delete()
		.eq("user_id", userId)
		.is("parent_transaction_id", null);
	if (error) throw error;
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });

	tenantEmail = `trig+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email: tenantEmail,
		password: "integration-test-pw-1234",
		email_confirm: true,
		user_metadata: { display_name: "Trigger Test" },
	});
	if (created.error || !created.data.user) throw created.error;
	userId = created.data.user.id;

	const { data: tags, error: tagErr } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	if (tagErr || !tags) throw tagErr ?? new Error("tags missing");
	const foods = tags.find((t) => t.name === "foods" && t.type === "expense" && !t.is_system);
	if (!foods) throw new Error("seeded 'foods' tag not found");
	foodsTagId = foods.id;

	const { data: cashRow, error: cashErr } = await admin
		.from("account")
		.insert({ user_id: userId, name: "Cash", type: "cash", initial_balance_centavos: 1_000_00 })
		.select("id")
		.single();
	if (cashErr || !cashRow) throw cashErr ?? new Error("cash account not created");
	cashId = cashRow.id;

	const { data: walletRow, error: walletErr } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Wallet",
			type: "e-wallet",
			initial_balance_centavos: 500_00,
		})
		.select("id")
		.single();
	if (walletErr || !walletRow) throw walletErr ?? new Error("wallet account not created");
	walletId = walletRow.id;

	// Credit card: starts with ₱200 existing debt (initial_balance), limit ₱50k.
	const { data: cardRow, error: cardErr } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "RCBC Flex",
			type: "credit",
			initial_balance_centavos: 200_00,
			credit_limit_centavos: 50_000_00,
		})
		.select("id")
		.single();
	if (cardErr || !cardRow) throw cardErr ?? new Error("credit card not created");
	cardId = cardRow.id;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	if (userId) {
		await admin.auth.admin.deleteUser(userId);
	}
});

beforeEach(async () => {
	if (!canRun) return;
	await wipeTransactions();
	expect(await balanceOf(cashId)).toBe(1_000_00);
	expect(await balanceOf(walletId)).toBe(500_00);
	expect(await balanceOf(cardId)).toBe(200_00);
});

runOrSkip("balance-delta trigger", () => {
	it("INSERT expense drops from-account balance", async () => {
		const { error } = await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 200_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: cashId,
			date: "2026-04-24",
		});
		expect(error).toBeNull();
		expect(await balanceOf(cashId)).toBe(800_00);
		expect(await balanceOf(walletId)).toBe(500_00);
	});

	it("UPDATE amount adjusts balance by the diff", async () => {
		const { data: row } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(900_00);
		await admin.from("transaction").update({ amount_centavos: 150_00 }).eq("id", row!.id);
		expect(await balanceOf(cashId)).toBe(850_00);
	});

	it("UPDATE type from expense to income flips the sign", async () => {
		const { data: row } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(900_00);

		await admin
			.from("transaction")
			.update({
				type: "income",
				from_account_id: null,
				to_account_id: walletId,
			})
			.eq("id", row!.id);

		// Cash restored, wallet grew.
		expect(await balanceOf(cashId)).toBe(1_000_00);
		expect(await balanceOf(walletId)).toBe(600_00);
	});

	it("UPDATE from_account reverts old and debits new", async () => {
		const { data: row } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 50_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(950_00);

		await admin.from("transaction").update({ from_account_id: walletId }).eq("id", row!.id);
		expect(await balanceOf(cashId)).toBe(1_000_00);
		expect(await balanceOf(walletId)).toBe(450_00);
	});

	it("DELETE restores balances", async () => {
		const { data: row } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 300_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(700_00);
		expect(await balanceOf(walletId)).toBe(800_00);

		await admin.from("transaction").delete().eq("id", row!.id);
		expect(await balanceOf(cashId)).toBe(1_000_00);
		expect(await balanceOf(walletId)).toBe(500_00);
	});

	it("transfer INSERT debits from and credits to", async () => {
		await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 250_00,
			type: "transfer",
			from_account_id: cashId,
			to_account_id: walletId,
			date: "2026-04-24",
		});
		expect(await balanceOf(cashId)).toBe(750_00);
		expect(await balanceOf(walletId)).toBe(750_00);
	});
});

// Credit accounts store debt as positive centavos; the trigger must flip the
// sign relative to asset accounts. Card + ₱200 initial debt for these cases.
runOrSkip("credit-account sign flipping", () => {
	it("expense from card raises the card's debt balance", async () => {
		await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 300_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: cardId,
			date: "2026-04-24",
		});
		expect(await balanceOf(cardId)).toBe(500_00); // 200 + 300
	});

	it("income to card (refund) lowers the card's debt balance", async () => {
		await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 50_00,
			type: "income",
			tag_id: foodsTagId,
			to_account_id: cardId,
			date: "2026-04-24",
		});
		expect(await balanceOf(cardId)).toBe(150_00); // 200 - 50
	});

	it("transfer bank → card (payment) lowers debt AND the bank balance", async () => {
		await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 150_00,
			type: "transfer",
			from_account_id: cashId,
			to_account_id: cardId,
			date: "2026-04-24",
		});
		expect(await balanceOf(cashId)).toBe(850_00); // 1000 - 150
		expect(await balanceOf(cardId)).toBe(50_00); // 200 - 150 (debt paid down)
	});

	it("transfer card → bank (cash advance) raises card debt and bank balance", async () => {
		await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 100_00,
			type: "transfer",
			from_account_id: cardId,
			to_account_id: cashId,
			date: "2026-04-24",
		});
		expect(await balanceOf(cardId)).toBe(300_00); // 200 + 100
		expect(await balanceOf(cashId)).toBe(1_100_00); // 1000 + 100
	});

	it("UPDATE amount on a card payment adjusts debt correctly", async () => {
		const { data } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: cardId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cardId)).toBe(100_00); // 200 - 100
		await admin.from("transaction").update({ amount_centavos: 175_00 }).eq("id", data!.id);
		expect(await balanceOf(cardId)).toBe(25_00); // 200 - 175
		expect(await balanceOf(cashId)).toBe(825_00); // 1000 - 175
	});

	it("DELETE card payment restores both balances", async () => {
		const { data } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: cardId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		await admin.from("transaction").delete().eq("id", data!.id);
		expect(await balanceOf(cardId)).toBe(200_00);
		expect(await balanceOf(cashId)).toBe(1_000_00);
	});
});

runOrSkip("paired transfer-fees trigger", () => {
	async function fetchChild(parentId: string) {
		const { data, error } = await admin
			.from("transaction")
			.select("*")
			.eq("parent_transaction_id", parentId)
			.maybeSingle();
		if (error) throw error;
		return data;
	}

	it("INSERT transfer with fee creates paired child and drops from by amount+fee", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 200_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				fee_centavos: 5_00,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(795_00); // 1000 - 200 - 5
		expect(await balanceOf(walletId)).toBe(700_00); // 500 + 200

		const child = await fetchChild(parent!.id);
		expect(child).not.toBeNull();
		expect(child!.type).toBe("expense");
		expect(child!.amount_centavos).toBe(5_00);
		expect(child!.from_account_id).toBe(cashId);
	});

	it("UPDATE fee NULL→X inserts a paired child", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await fetchChild(parent!.id)).toBeNull();
		expect(await balanceOf(cashId)).toBe(900_00);

		await admin.from("transaction").update({ fee_centavos: 10_00 }).eq("id", parent!.id);
		const child = await fetchChild(parent!.id);
		expect(child).not.toBeNull();
		expect(child!.amount_centavos).toBe(10_00);
		expect(await balanceOf(cashId)).toBe(890_00);
	});

	it("UPDATE fee X→Y updates child amount", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				fee_centavos: 10_00,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(890_00);

		await admin.from("transaction").update({ fee_centavos: 25_00 }).eq("id", parent!.id);
		const child = await fetchChild(parent!.id);
		expect(child!.amount_centavos).toBe(25_00);
		expect(await balanceOf(cashId)).toBe(875_00); // 900 - 25
	});

	it("UPDATE fee X→NULL deletes the child", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				fee_centavos: 20_00,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await fetchChild(parent!.id)).not.toBeNull();

		await admin.from("transaction").update({ fee_centavos: null }).eq("id", parent!.id);
		expect(await fetchChild(parent!.id)).toBeNull();
		expect(await balanceOf(cashId)).toBe(900_00); // fee refunded
	});

	it("UPDATE from_account also updates child's from_account", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				fee_centavos: 15_00,
				date: "2026-04-24",
			})
			.select("id")
			.single();

		await admin
			.from("transaction")
			.update({ from_account_id: walletId, to_account_id: cashId })
			.eq("id", parent!.id);
		const child = await fetchChild(parent!.id);
		expect(child!.from_account_id).toBe(walletId);
		// cash: 1000 + 100 = 1100 (was debited 115, now credited 100 = net +100 - but
		// the debit of 115 was reversed and a credit of 100 applied: 1000 - 0 + 100 = 1100).
		// wallet: 500 - 100 - 15 = 385 (credit of 100 was reversed; debit of 100 + fee 15 applied).
		expect(await balanceOf(cashId)).toBe(1_100_00);
		expect(await balanceOf(walletId)).toBe(385_00);
	});

	it("UPDATE transfer→expense deletes the child", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				fee_centavos: 20_00,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await fetchChild(parent!.id)).not.toBeNull();

		await admin
			.from("transaction")
			.update({
				type: "expense",
				tag_id: foodsTagId,
				to_account_id: null,
				fee_centavos: null,
			})
			.eq("id", parent!.id);
		expect(await fetchChild(parent!.id)).toBeNull();
	});

	it("DELETE parent cascades to child", async () => {
		const { data: parent } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				amount_centavos: 100_00,
				type: "transfer",
				from_account_id: cashId,
				to_account_id: walletId,
				fee_centavos: 20_00,
				date: "2026-04-24",
			})
			.select("id")
			.single();
		expect(await balanceOf(cashId)).toBe(880_00);

		await admin.from("transaction").delete().eq("id", parent!.id);
		expect(await fetchChild(parent!.id)).toBeNull();
		expect(await balanceOf(cashId)).toBe(1_000_00);
		expect(await balanceOf(walletId)).toBe(500_00);
	});
});
