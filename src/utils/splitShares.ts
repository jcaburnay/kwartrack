// Pure share-distribution math for the Split feature.
// Kept outside the modal so the four methods (equal/exact/percentage/shares)
// can be exercised as plain BigInt functions — no React, no form state.
//
// Conventions shared with SplitModal.tsx:
// - "you" (the payer) are always implicit: every method assumes one extra
//   participant beyond the entries in `participants`
// - BigInt integer division in "equal" mode floors remainders, so the sum of
//   shares can be up to (count - 1) centavos less than the total — existing
//   behaviour of the app, preserved here bug-for-bug

export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export interface SplitShareInput {
	name: string;
	shareAmount: string; // used by "exact"
	sharePercentage: string; // used by "percentage"
	shareCount: number; // used by "shares"
}

export function parseCentavos(input: string): bigint {
	return BigInt(Math.round(parseFloat(input || "0") * 100));
}

function filterValid(participants: readonly SplitShareInput[]): SplitShareInput[] {
	return participants.filter((p) => p.name.trim());
}

// Your (the payer's) residual share — what's left after every other participant's claim.
export function computeYourShareCentavos(
	method: SplitMethod,
	participants: readonly SplitShareInput[],
	totalCentavos: bigint,
): bigint {
	const valid = filterValid(participants);
	const count = valid.length + 1;

	if (method === "equal") return totalCentavos / BigInt(count);
	if (method === "exact") {
		const sum = valid.reduce((s, p) => s + parseCentavos(p.shareAmount), 0n);
		return totalCentavos - sum;
	}
	if (method === "percentage") {
		const sumPct = valid.reduce((s, p) => s + parseFloat(p.sharePercentage || "0"), 0);
		return BigInt(Math.round(((100 - sumPct) / 100) * Number(totalCentavos)));
	}
	// "shares" — you always count as 1 share; totalShares counts every row (named or not)
	// to match the modal's on-screen preview.
	const totalShares = participants.reduce((s, p) => s + p.shareCount, 0) + 1;
	return BigInt(Math.round((1 / totalShares) * Number(totalCentavos)));
}

// One participant's share given the method and the full participant list.
export function computeParticipantShareCentavos(
	participant: SplitShareInput,
	method: SplitMethod,
	participants: readonly SplitShareInput[],
	totalCentavos: bigint,
): bigint {
	const valid = filterValid(participants);
	const count = valid.length + 1;

	if (method === "equal") return totalCentavos / BigInt(count);
	if (method === "exact") return parseCentavos(participant.shareAmount);
	if (method === "percentage")
		return BigInt(
			Math.round((parseFloat(participant.sharePercentage || "0") / 100) * Number(totalCentavos)),
		);
	const totalShares = participants.reduce((s, p) => s + p.shareCount, 0) + 1;
	return BigInt(Math.round((participant.shareCount / totalShares) * Number(totalCentavos)));
}

// Returns a human-readable error message, or null when the current shares are acceptable.
// Does NOT check for overpayment by "you" — the residual absorbs the difference by design.
export function validateShares(
	method: SplitMethod,
	participants: readonly SplitShareInput[],
	totalCentavos: bigint,
): string | null {
	const valid = filterValid(participants);
	if (valid.length === 0) return "At least one participant name is required";

	if (method === "exact") {
		const sum = valid.reduce((s, p) => s + parseCentavos(p.shareAmount), 0n);
		if (sum > totalCentavos) return "Participant shares exceed the total amount";
	}
	if (method === "percentage") {
		const sum = valid.reduce((s, p) => s + parseFloat(p.sharePercentage || "0"), 0);
		if (sum > 100) return "Participant percentages exceed 100%";
	}
	return null;
}
