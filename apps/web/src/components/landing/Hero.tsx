import { Link } from "react-router";
import { GITHUB_URL, HEADLINE, SUBHEAD, TRUST_LINE } from "./content";
import { DashboardPreview } from "./DashboardPreview";
import { GithubIcon } from "./GithubIcon";

export function Hero() {
	return (
		<section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:pt-20">
			<div className="grid items-center gap-10 lg:grid-cols-2">
				<div className="flex flex-col gap-5">
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{HEADLINE}</h1>
					<p className="text-base-content/70 text-lg leading-relaxed">{SUBHEAD}</p>
					<div className="flex flex-wrap gap-3">
						<Link to="/signup" className="btn btn-primary">
							Get started — it's free
						</Link>
						<a href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn btn-outline">
							<GithubIcon className="size-4" /> View on GitHub
						</a>
					</div>
					<p className="text-sm text-base-content/60">{TRUST_LINE}</p>
				</div>
				<DashboardPreview />
			</div>
		</section>
	);
}
