import { SenderError, t } from "spacetimedb/server";
import spacetimedb from "../schema";

// =============================================================================
// IDENTITY REDUCERS
// =============================================================================

// link_clerk_identity
// Client: conn.reducers.linkClerkIdentity({ clerkUserId: 'user_2abc...', displayName: 'Alice' })
// Called on every connect. Registers this STDB identity as an alias of the primary identity
// for this Clerk user. Never transfers data ownership — all devices always share the same
// primary identity's data, enabling true multi-device/multi-browser concurrent access.
export const link_clerk_identity = spacetimedb.reducer(
	{ clerkUserId: t.string(), displayName: t.string() },
	(ctx, { clerkUserId, displayName }) => {
		if (!clerkUserId.trim()) throw new SenderError("clerkUserId is required");

		// If this STDB identity is already registered, just update display name if needed
		const existingAlias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
		if (existingAlias) {
			const profile = ctx.db.userProfile.identity.find(existingAlias.primaryIdentity);
			if (profile && profile.displayName !== displayName) {
				ctx.db.userProfile.identity.update({ ...profile, displayName });
			}
			return;
		}

		const existingProfile = ctx.db.userProfile.clerkUserId.find(clerkUserId);

		if (!existingProfile) {
			// First-time user: this identity becomes the primary
			ctx.db.userProfile.insert({
				identity: ctx.sender,
				clerkUserId,
				displayName,
				createdAt: ctx.timestamp,
			});
			ctx.db.identity_alias.insert({
				stdbIdentity: ctx.sender,
				primaryIdentity: ctx.sender,
				clerkUserId,
			});
			return;
		}

		// Known Clerk user, new device/browser: register as alias of existing primary
		// Data stays owned by primaryIdentity — no ownership transfer needed
		ctx.db.identity_alias.insert({
			stdbIdentity: ctx.sender,
			primaryIdentity: existingProfile.identity,
			clerkUserId,
		});
		if (existingProfile.displayName !== displayName) {
			ctx.db.userProfile.identity.update({ ...existingProfile, displayName });
		}
	},
);
