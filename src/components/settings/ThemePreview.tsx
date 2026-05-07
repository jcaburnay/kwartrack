import { resolveTheme, type Theme } from "../../hooks/useTheme";

type ThemePreviewProps = {
	theme: Theme;
};

// A faux mini-dashboard that renders entirely with DaisyUI semantic tokens, so
// wrapping it in `<div data-theme="…">` swaps every color via CSS variables.
export function ThemePreview({ theme }: ThemePreviewProps) {
	const resolved = resolveTheme(theme);
	return (
		<div
			data-theme={resolved}
			className="rounded-box border border-base-300 bg-base-200 overflow-hidden shadow-sm select-none"
			aria-hidden
		>
			{/* Navbar strip */}
			<div className="h-9 px-3 flex items-center justify-between bg-base-100 border-b border-base-300">
				<span className="text-sm font-medium">kwartrack</span>
				<div className="w-6 h-6 rounded-full bg-primary text-primary-content flex items-center justify-center text-[10px] font-medium">
					JC
				</div>
			</div>

			<div className="p-3 flex flex-col gap-3 bg-base-100">
				{/* Net worth tile */}
				<div>
					<div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
						Net worth
					</div>
					<div className="text-2xl font-semibold tabular-nums leading-tight">₱93,420.50</div>
					<svg viewBox="0 0 120 32" className="w-full h-8 mt-1" fill="none" aria-hidden>
						<title>preview-trend</title>
						<path
							d="M0 24 L12 20 L24 22 L36 16 L48 18 L60 12 L72 14 L84 8 L96 10 L108 6 L120 4"
							stroke="currentColor"
							strokeWidth="1.5"
							className="text-primary"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>

				{/* Budget bar */}
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between text-[11px]">
						<span className="text-base-content/70">Food</span>
						<span className="text-base-content/50 tabular-nums">60% of ₱8,000</span>
					</div>
					<progress className="progress progress-success h-1.5" value={60} max={100} />
				</div>

				{/* Action row */}
				<div className="flex items-center gap-2">
					<button type="button" className="btn btn-primary btn-xs">
						+ Add account
					</button>
					<button type="button" className="btn btn-ghost btn-xs">
						View all
					</button>
				</div>
			</div>
		</div>
	);
}
