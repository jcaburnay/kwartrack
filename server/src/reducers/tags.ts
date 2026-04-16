import { SenderError, t } from "spacetimedb/server";
import { DEFAULT_TAGS_BY_TYPE, isAuthorized, normalizeTagName, resolveOwner } from "../helpers";
import spacetimedb from "../schema";

// =============================================================================
// TAG CONFIG REDUCERS
// =============================================================================

export const add_custom_tag = spacetimedb.reducer(
	{
		transactionType: t.string(),
		tag: t.string(),
	},
	(ctx, { transactionType, tag }) => {
		const normalizedTag = normalizeTagName(tag);
		if (!normalizedTag) throw new SenderError("Tag name is required");
		if (DEFAULT_TAGS_BY_TYPE[transactionType]?.includes(normalizedTag)) {
			throw new SenderError("Tag already exists for this type");
		}
		const ownerIdentity = resolveOwner(ctx);
		for (const config of ctx.db.user_tag_config.tag_config_owner.filter(ownerIdentity)) {
			if (config.transactionType === transactionType && config.tag === normalizedTag) {
				throw new SenderError("Tag already exists for this type");
			}
		}
		ctx.db.user_tag_config.insert({
			id: 0n,
			ownerIdentity,
			transactionType,
			tag: normalizedTag,
			isCustom: true,
			isHidden: false,
		});
	},
);

export const delete_custom_tag = spacetimedb.reducer(
	{ tagConfigId: t.u64() },
	(ctx, { tagConfigId }) => {
		const existing = ctx.db.user_tag_config.id.find(tagConfigId);
		if (!existing) throw new SenderError("Tag config not found");
		if (!isAuthorized(ctx, existing.ownerIdentity)) {
			throw new SenderError("Not authorized");
		}
		if (!existing.isCustom) {
			throw new SenderError("Cannot delete default tags");
		}
		ctx.db.user_tag_config.id.delete(tagConfigId);
	},
);

export const toggle_tag_visibility = spacetimedb.reducer(
	{
		transactionType: t.string(),
		tag: t.string(),
	},
	(ctx, { transactionType, tag }) => {
		const ownerIdentity = resolveOwner(ctx);
		const found =
			[...ctx.db.user_tag_config.tag_config_owner.filter(ownerIdentity)].find(
				(config) => config.transactionType === transactionType && config.tag === tag,
			) ?? null;
		if (found) {
			ctx.db.user_tag_config.id.update({
				...found,
				isHidden: !found.isHidden,
			});
		} else {
			ctx.db.user_tag_config.insert({
				id: 0n,
				ownerIdentity,
				transactionType,
				tag,
				isCustom: false,
				isHidden: true,
			});
		}
	},
);
