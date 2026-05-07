import { useEffect, useState } from "react";
import { DeleteAccountDialog } from "../components/settings/DeleteAccountDialog";
import { SettingsSection } from "../components/settings/SettingsSection";
import { TimezonePicker } from "../components/settings/TimezonePicker";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { initialsFrom } from "../utils/initials";

type RowProps = {
	label: string;
	helper?: string;
	children: React.ReactNode;
};

function Row({ label, helper, children }: RowProps) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-4">
			<div className="flex flex-col gap-0.5 min-w-0 sm:max-w-[16rem]">
				<span className="text-sm font-medium">{label}</span>
				{helper && <span className="text-xs text-base-content/60">{helper}</span>}
			</div>
			<div className="flex-1 sm:flex-none sm:max-w-[24rem] w-full sm:w-auto sm:flex sm:justify-end">
				{children}
			</div>
		</div>
	);
}

export function SettingsProfilePage() {
	const { profile, user, signOut } = useAuth();
	const { updateProfile } = useProfile();

	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState(profile?.display_name ?? "");
	const [nameError, setNameError] = useState<string | null>(null);
	const [savingName, setSavingName] = useState(false);

	const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");
	const [resetError, setResetError] = useState<string | null>(null);

	const [tzSaving, setTzSaving] = useState(false);
	const [tzError, setTzError] = useState<string | null>(null);

	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		setNameDraft(profile?.display_name ?? "");
	}, [profile?.display_name]);

	useEffect(() => {
		if (resetState !== "sent") return;
		const t = window.setTimeout(() => setResetState("idle"), 5000);
		return () => window.clearTimeout(t);
	}, [resetState]);

	if (!profile || !user) {
		return (
			<div className="flex justify-center py-10">
				<span className="loading loading-spinner text-primary" />
			</div>
		);
	}

	const email = user.email ?? "—";

	const saveName = async () => {
		const trimmed = nameDraft.trim();
		if (trimmed.length < 1 || trimmed.length > 50) {
			setNameError("Display name must be 1–50 characters.");
			return;
		}
		setSavingName(true);
		setNameError(null);
		try {
			await updateProfile({ display_name: trimmed });
			setEditingName(false);
		} catch (e) {
			setNameError(e instanceof Error ? e.message : "Could not save.");
		} finally {
			setSavingName(false);
		}
	};

	const sendPasswordReset = async () => {
		if (!user.email) return;
		setResetState("sending");
		setResetError(null);
		const { error } = await supabase.auth.resetPasswordForEmail(user.email);
		if (error) {
			setResetError(error.message);
			setResetState("error");
		} else {
			setResetState("sent");
		}
	};

	const setTimezone = async (zone: string) => {
		setTzSaving(true);
		setTzError(null);
		try {
			await updateProfile({ timezone: zone });
		} catch (e) {
			setTzError(e instanceof Error ? e.message : "Could not save timezone.");
		} finally {
			setTzSaving(false);
		}
	};

	return (
		<SettingsSection
			title="Profile"
			description="Your identity inside kwartrack and the bits the app needs to behave correctly."
		>
			<div className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100">
				{/* Identity row */}
				<div className="flex items-center gap-4 p-4">
					<div className="avatar avatar-placeholder">
						<div className="bg-primary text-primary-content w-14 rounded-full">
							<span className="text-lg font-medium">{initialsFrom(profile.display_name)}</span>
						</div>
					</div>
					<div className="min-w-0">
						<p className="text-base font-medium truncate">{profile.display_name}</p>
						<p className="text-sm text-base-content/60 truncate">{email}</p>
					</div>
				</div>

				{/* Display name */}
				<Row label="Display name" helper="Shown across the app and on your avatar.">
					{editingName ? (
						<div className="flex flex-col gap-1.5 w-full">
							<div className="flex gap-2">
								<input
									type="text"
									className="input input-bordered input-sm flex-1"
									value={nameDraft}
									maxLength={50}
									onChange={(e) => setNameDraft(e.target.value)}
									autoFocus
								/>
								<button
									type="button"
									className="btn btn-sm btn-primary"
									onClick={saveName}
									disabled={savingName}
								>
									{savingName ? "Saving…" : "Save"}
								</button>
								<button
									type="button"
									className="btn btn-sm btn-ghost"
									onClick={() => {
										setEditingName(false);
										setNameDraft(profile.display_name ?? "");
										setNameError(null);
									}}
									disabled={savingName}
								>
									Cancel
								</button>
							</div>
							{nameError && <p className="text-xs text-error">{nameError}</p>}
						</div>
					) : (
						<div className="flex items-center gap-2 justify-between sm:justify-end w-full">
							<span className="text-sm">{profile.display_name}</span>
							<button
								type="button"
								className="btn btn-xs btn-ghost"
								onClick={() => setEditingName(true)}
							>
								Edit
							</button>
						</div>
					)}
				</Row>

				{/* Email */}
				<Row label="Email" helper="Used for sign-in and reset emails.">
					<div className="flex items-center gap-2 justify-between sm:justify-end w-full">
						<span className="text-sm tabular-nums">{email}</span>
					</div>
				</Row>

				{/* Password */}
				<Row
					label="Password"
					helper="We send a reset link to your email — change it from the link inside."
				>
					<div className="flex items-center gap-2 justify-between sm:justify-end w-full">
						<span className="text-xs text-base-content/60">
							{resetState === "sent" && "Reset email sent."}
							{resetState === "error" && (resetError ?? "Couldn’t send.")}
						</span>
						<button
							type="button"
							className="btn btn-xs btn-ghost"
							onClick={sendPasswordReset}
							disabled={resetState === "sending"}
						>
							{resetState === "sending" ? "Sending…" : "Send reset email"}
						</button>
					</div>
				</Row>

				{/* Timezone */}
				<Row
					label="Timezone"
					helper="Used to fire recurring transactions at midnight local time. Change if it’s wrong."
				>
					<div className="flex flex-col gap-1 w-full sm:items-end">
						<TimezonePicker value={profile.timezone} onChange={setTimezone} />
						{tzSaving && <span className="text-xs text-base-content/60">Saving…</span>}
						{tzError && <span className="text-xs text-error">{tzError}</span>}
					</div>
				</Row>

				{/* Sign out */}
				<Row label="Sign out" helper="Signs out of this device only.">
					<button type="button" className="btn btn-sm btn-ghost" onClick={() => void signOut()}>
						Sign out
					</button>
				</Row>
			</div>

			{/* Danger zone */}
			<div className="rounded-box border border-error/30 bg-base-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
				<div className="flex flex-col gap-1 min-w-0">
					<span className="text-xs font-semibold uppercase tracking-wide text-error">
						Danger zone
					</span>
					<p className="text-sm text-base-content/70">
						Delete your account and every record you own. No grace period, no undo.
					</p>
				</div>
				<button
					type="button"
					className="btn btn-sm btn-outline btn-error self-start sm:self-auto"
					onClick={() => setDeleting(true)}
				>
					Delete account
				</button>
			</div>

			{deleting && (
				<DeleteAccountDialog
					displayName={profile.display_name}
					onClose={() => setDeleting(false)}
					onConfirm={async () => {
						// Cascade-delete RPC lands in a follow-up. For now, surface an explicit
						// error so we don't silently sign the user out and leave their data.
						throw new Error(
							"Account deletion is being wired up. Please contact support to delete your data.",
						);
					}}
				/>
			)}
		</SettingsSection>
	);
}
