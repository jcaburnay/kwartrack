import type { ReactNode } from "react";

type SettingsSectionProps = {
	title: string;
	description?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
};

export function SettingsSection({ title, description, action, children }: SettingsSectionProps) {
	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div className="flex flex-col gap-1 min-w-0">
					<h2 className="text-lg font-semibold leading-tight">{title}</h2>
					{description != null && (
						<p className="text-sm text-base-content/60 max-w-prose">{description}</p>
					)}
				</div>
				{action != null && <div className="shrink-0">{action}</div>}
			</header>
			{children}
		</div>
	);
}
