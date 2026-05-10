import { Check } from "lucide-react";
import { useState } from "react";
import { SettingsSection } from "../components/settings/SettingsSection";
import { ThemePreview } from "../components/settings/ThemePreview";
import { THEMES, type Theme, useTheme } from "../hooks/useTheme";

const SWATCH_LABELS: Record<Theme, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
	corporate: "Corporate",
	business: "Business",
	emerald: "Emerald",
	cupcake: "Cupcake",
	lemonade: "Lemonade",
	winter: "Winter",
	night: "Night",
	dim: "Dim",
};

const SWATCH_HINTS: Partial<Record<Theme, string>> = {
	system: "Follows OS",
};

type SwatchTileProps = {
	value: Theme;
	selected: boolean;
	onSelect: (next: Theme) => void;
	onHover: (next: Theme | null) => void;
};

function SwatchTile({ value, selected, onSelect, onHover }: SwatchTileProps) {
	const isSystem = value === "system";

	return (
		// biome-ignore lint/a11y/useSemanticElements: Each swatch is a visual tile that needs to host a complex preview, not a literal <input type="radio">. Keeping role="radio" gives the right a11y semantics inside the radiogroup.
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			aria-label={SWATCH_LABELS[value]}
			onClick={() => onSelect(value)}
			onMouseEnter={() => onHover(value)}
			onMouseLeave={() => onHover(null)}
			onFocus={() => onHover(value)}
			onBlur={() => onHover(null)}
			className={`relative flex flex-col gap-1.5 p-1.5 rounded-box transition-all outline-none ${
				selected
					? "ring-2 ring-primary ring-offset-2 ring-offset-base-100"
					: "hover:ring-1 hover:ring-base-content/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
			}`}
		>
			{isSystem ? (
				<SystemTile />
			) : (
				<div data-theme={value} className="rounded-md overflow-hidden w-full">
					<TilePalette />
				</div>
			)}
			<div className="flex items-center justify-between gap-1 px-0.5">
				<span className="text-xs font-medium text-base-content truncate">
					{SWATCH_LABELS[value]}
				</span>
				{SWATCH_HINTS[value] && (
					<span className="text-[10px] text-base-content/50 truncate">{SWATCH_HINTS[value]}</span>
				)}
			</div>
			{selected && (
				<span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center shadow">
					<Check className="w-3 h-3" />
				</span>
			)}
		</button>
	);
}

function TilePalette() {
	return (
		<div className="grid grid-cols-4 h-14">
			<div className="bg-base-100 border-r border-base-300/50" />
			<div className="bg-primary" />
			<div className="bg-secondary" />
			<div className="bg-base-300" />
		</div>
	);
}

function SystemTile() {
	return (
		<div className="grid grid-cols-2 h-14 rounded-md overflow-hidden w-full">
			<div data-theme="corporate">
				<div className="grid grid-rows-2 h-full">
					<div className="bg-base-100" />
					<div className="bg-primary" />
				</div>
			</div>
			<div data-theme="business">
				<div className="grid grid-rows-2 h-full">
					<div className="bg-base-100" />
					<div className="bg-primary" />
				</div>
			</div>
		</div>
	);
}

export function SettingsAppearancePage() {
	const { theme, setTheme } = useTheme();
	const [hovered, setHovered] = useState<Theme | null>(null);
	const previewTheme = hovered ?? theme;

	return (
		<SettingsSection
			title="Appearance"
			description="Pick the look that suits you. Themes apply instantly and sync across devices when you're signed in."
		>
			<div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6 items-start">
				{/* Swatch grid */}
				<div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
					{THEMES.map((t) => (
						<SwatchTile
							key={t}
							value={t}
							selected={theme === t}
							onSelect={setTheme}
							onHover={setHovered}
						/>
					))}
				</div>

				{/* Preview pane */}
				<div className="lg:sticky lg:top-24 flex flex-col gap-2">
					<div className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
						Preview · {SWATCH_LABELS[previewTheme]}
					</div>
					<ThemePreview theme={previewTheme} />
					<p className="text-xs text-base-content/60">
						Hover any swatch for a peek; click to commit.
					</p>
				</div>
			</div>
		</SettingsSection>
	);
}
