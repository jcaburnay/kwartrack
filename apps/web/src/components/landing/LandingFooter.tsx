import { DOCS_URL, GITHUB_URL } from "./content";

export function LandingFooter() {
	return (
		<footer className="border-t border-base-300">
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-8 text-sm text-base-content/60">
				<span className="font-medium">
					<span className="text-primary">₱</span> Kwartrack
				</span>
				<span aria-hidden>·</span>
				<a href={GITHUB_URL} target="_blank" rel="noreferrer" className="link link-hover">
					GitHub
				</a>
				<span aria-hidden>·</span>
				<a href={DOCS_URL} target="_blank" rel="noreferrer" className="link link-hover">
					Docs
				</a>
				<span aria-hidden>·</span>
				<a
					href={`${GITHUB_URL}/blob/main/LICENSE`}
					target="_blank"
					rel="noreferrer"
					className="link link-hover"
				>
					MIT License
				</a>
				<span aria-hidden>·</span>
				<span>© 2026</span>
			</div>
		</footer>
	);
}
