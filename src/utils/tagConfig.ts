/**
 * Shared tag configuration utility.
 * Resolves visible tags by merging defaults with user customizations.
 */

export const DEFAULT_TAGS: Record<string, readonly string[]> = {
	expense: [
		"foods",
		"grocery",
		"transportation",
		"online-shopping",
		"gadgets",
		"bills",
		"pets",
		"personal-care",
		"health",
		"digital-subscriptions",
		"entertainment",
		"clothing",
		"education",
		"travel",
		"housing",
		"insurance",
		"gifts",
	],
	income: ["monthly-salary", "freelance", "interest", "bonus", "gifts"],
	transfer: [],
};

export interface TagConfigRow {
	transactionType: string;
	tag: string;
	isCustom: boolean;
	isHidden: boolean;
}

/**
 * Returns the visible tags for a transaction type by merging defaults with user configs.
 * - Default tags minus hidden ones
 * - Plus custom tags that are not hidden
 */
export function getVisibleTags(type: string, tagConfigs: readonly TagConfigRow[]): string[] {
	const typeConfigs = tagConfigs.filter((c) => c.transactionType === type);
	const hiddenTags = new Set(typeConfigs.filter((c) => c.isHidden).map((c) => c.tag));
	const defaults = (DEFAULT_TAGS[type] ?? []).filter((tag) => !hiddenTags.has(tag));
	const custom = typeConfigs.filter((c) => c.isCustom && !c.isHidden).map((c) => c.tag);
	return [...new Set([...defaults, ...custom])];
}
