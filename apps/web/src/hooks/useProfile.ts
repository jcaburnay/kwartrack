import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import type { Database } from "../types/supabase";

type UserProfile = Database["public"]["Tables"]["user_profile"]["Row"];
type ProfilePatch = Pick<
	Database["public"]["Tables"]["user_profile"]["Update"],
	"display_name" | "theme" | "timezone"
>;

type UseProfile = {
	profile: UserProfile | null;
	updateProfile: (patch: ProfilePatch) => Promise<void>;
};

export function useProfile(): UseProfile {
	const { profile, patchProfileOptimistic, refreshProfile, user } = useAuth();

	const updateProfile = useCallback(
		async (patch: ProfilePatch) => {
			if (!user) throw new Error("Cannot update profile without a signed-in user");
			patchProfileOptimistic(patch);
			const { error } = await supabase.from("user_profile").update(patch).eq("id", user.id);
			if (error) {
				await refreshProfile();
				throw error;
			}
		},
		[user, patchProfileOptimistic, refreshProfile],
	);

	return { profile, updateProfile };
}
