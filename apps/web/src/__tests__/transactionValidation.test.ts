import { describe, expect, it } from "vitest";
import { type TransactionInput, validateTransaction } from "../utils/transactionValidation";

const base: TransactionInput = {
	type: "expense",
	amountCentavos: 100_00,
	tagId: "t",
	fromAccountId: "a",
	toAccountId: null,
	feeCentavos: null,
	description: "",
	date: "2026-04-24",
};

describe("validateTransaction", () => {
	it("accepts a valid expense", () => {
		expect(validateTransaction(base)).toEqual({ ok: true });
	});

	it("rejects non-positive amounts", () => {
		expect(validateTransaction({ ...base, amountCentavos: 0 })).toMatchObject({
			ok: false,
			field: "amount",
		});
	});

	it("rejects a blank date", () => {
		expect(validateTransaction({ ...base, date: "" })).toMatchObject({
			ok: false,
			field: "date",
		});
	});

	it("expense requires from", () => {
		expect(validateTransaction({ ...base, fromAccountId: null })).toMatchObject({
			ok: false,
			field: "fromAccountId",
		});
	});

	it("expense forbids a to account", () => {
		expect(validateTransaction({ ...base, toAccountId: "x" })).toMatchObject({
			ok: false,
			field: "toAccountId",
		});
	});

	it("expense requires a tag", () => {
		expect(validateTransaction({ ...base, tagId: null })).toMatchObject({
			ok: false,
			field: "tagId",
		});
	});

	it("expense forbids a fee", () => {
		expect(validateTransaction({ ...base, feeCentavos: 100 })).toMatchObject({
			ok: false,
			field: "fee",
		});
	});

	it("income requires to", () => {
		const income: TransactionInput = {
			...base,
			type: "income",
			fromAccountId: null,
			toAccountId: "a",
		};
		expect(validateTransaction(income)).toEqual({ ok: true });
		expect(validateTransaction({ ...income, toAccountId: null })).toMatchObject({
			ok: false,
			field: "toAccountId",
		});
	});

	it("income rejects a from account", () => {
		const income: TransactionInput = {
			...base,
			type: "income",
			fromAccountId: "a",
			toAccountId: "b",
		};
		expect(validateTransaction(income)).toMatchObject({
			ok: false,
			field: "fromAccountId",
		});
	});

	it("transfer requires both accounts and they must differ", () => {
		const transfer: TransactionInput = {
			...base,
			type: "transfer",
			fromAccountId: "a",
			toAccountId: "b",
			tagId: null,
		};
		expect(validateTransaction(transfer)).toEqual({ ok: true });
		expect(validateTransaction({ ...transfer, toAccountId: "a" })).toMatchObject({
			ok: false,
			field: "toAccountId",
		});
		expect(validateTransaction({ ...transfer, toAccountId: null })).toMatchObject({
			ok: false,
			field: "toAccountId",
		});
	});

	it("transfer fee must be > 0 when present", () => {
		const transfer: TransactionInput = {
			...base,
			type: "transfer",
			fromAccountId: "a",
			toAccountId: "b",
			tagId: null,
			feeCentavos: 0,
		};
		expect(validateTransaction(transfer)).toMatchObject({
			ok: false,
			field: "fee",
		});
		expect(validateTransaction({ ...transfer, feeCentavos: 50 })).toEqual({ ok: true });
	});
});
