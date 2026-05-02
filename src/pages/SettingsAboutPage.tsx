export function SettingsAboutPage() {
	return (
		<div className="flex flex-col gap-3">
			<h2 className="text-lg font-semibold">Help &amp; about</h2>
			<p className="text-sm text-base-content/70">kwartrack v{__APP_VERSION__}</p>
			<div className="flex flex-col gap-1 text-sm">
				<a
					className="link link-hover"
					href="https://github.com/jcaburnay/kwartrack/releases"
					target="_blank"
					rel="noopener noreferrer"
				>
					What's new →
				</a>
				<a
					className="link link-hover"
					href="mailto:jonathan@caburnay.dev?subject=Kwartrack%20feedback"
				>
					Feedback →
				</a>
			</div>
		</div>
	);
}
