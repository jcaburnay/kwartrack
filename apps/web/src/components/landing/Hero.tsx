import { Link } from "react-router";
import { GITHUB_URL, HEADLINE, SUBHEAD, TRUST_LINE } from "./content";
import { DashboardPreview } from "./DashboardPreview";
import { GithubIcon } from "./GithubIcon";

export function Hero() {
	return (
		<section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:pt-20">
			<div className="grid min-w-0 grid-cols-1 items-center gap-10 lg:grid-cols-2">
				<div className="flex min-w-0 flex-col gap-5">
					<h1 className="text-[clamp(2.25rem,10vw,3rem)] font-bold leading-tight tracking-tight">
						{HEADLINE}
					</h1>
					<p className="text-base-content/70 text-lg leading-relaxed">{SUBHEAD}</p>
					<div className="grid grid-cols-1 gap-3 min-[420px]:flex min-[420px]:flex-wrap">
						<Link to="/signup" className="btn btn-primary w-full min-[420px]:w-auto">
							Get started — it's free
						</Link>
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							className="btn btn-outline w-full min-[420px]:w-auto"
						>
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
