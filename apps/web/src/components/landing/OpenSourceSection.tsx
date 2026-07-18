import { GITHUB_URL } from "./content";
import { GithubIcon } from "./GithubIcon";

export function OpenSourceSection() {
	return (
		<section className="mx-auto max-w-3xl px-4 py-16 text-center">
			<h2 className="mb-3 text-2xl font-semibold sm:text-3xl">Open source, and honest about it</h2>
			<p className="mb-6 text-base-content/70">
				Built with React + Supabase. MIT licensed — read the code, file an issue, or fork it. No
				tracking, no lock-in.
			</p>
			<a href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn btn-outline">
				<GithubIcon className="size-4" /> Star on GitHub
			</a>
		</section>
	);
}
