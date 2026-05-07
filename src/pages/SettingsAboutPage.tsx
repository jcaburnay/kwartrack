import { ExternalLink } from "lucide-react";
import { SettingsSection } from "../components/settings/SettingsSection";
import { RELEASES_URL, SUPPORT_EMAIL } from "../lib/config";

type RowProps = {
	label: string;
	helper?: string;
	children: React.ReactNode;
};

function Row({ label, helper, children }: RowProps) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-4">
			<div className="flex flex-col gap-0.5">
				<span className="text-sm font-medium">{label}</span>
				{helper && <span className="text-xs text-base-content/60">{helper}</span>}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

export function SettingsAboutPage() {
	return (
		<SettingsSection
			title="Help & about"
			description="The version you’re running, what changed lately, and where to send feedback."
		>
			<div className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100">
				<Row label="Version">
					<span className="badge badge-ghost font-normal tabular-nums">
						kwartrack v{__APP_VERSION__}
					</span>
				</Row>
				<Row label="What's new" helper="Release notes on GitHub.">
					<a
						className="btn btn-ghost btn-sm"
						href={RELEASES_URL}
						target="_blank"
						rel="noopener noreferrer"
					>
						Open
						<ExternalLink className="size-3.5" aria-hidden />
					</a>
				</Row>
				<Row label="Feedback" helper="Bugs, feature ideas, or anything in between.">
					<a
						className="btn btn-ghost btn-sm"
						href={`mailto:${SUPPORT_EMAIL}?subject=Kwartrack%20feedback`}
					>
						Email
						<ExternalLink className="size-3.5" aria-hidden />
					</a>
				</Row>
			</div>
		</SettingsSection>
	);
}
