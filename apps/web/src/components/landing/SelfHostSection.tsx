import { Link } from "react-router";
import { SELF_HOST_URL } from "./content";

export function SelfHostSection() {
	return (
		<section id="self-host" className="bg-base-200 py-16">
			<div className="mx-auto max-w-6xl px-4">
				<h2 className="mb-8 text-center text-2xl font-semibold sm:text-3xl">
					Your money. Your data. Your choice.
				</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="card bg-base-100 border border-base-300">
						<div className="card-body gap-3">
							<h3 className="card-title">Hosted — kwartrack.com</h3>
							<ul className="text-sm text-base-content/70 space-y-1">
								<li>Zero setup, sign up free</li>
								<li>Always up to date</li>
								<li>Great for most people</li>
							</ul>
							<Link to="/signup" className="btn btn-primary btn-sm mt-2 w-fit">
								Get started
							</Link>
						</div>
					</div>
					<div className="card bg-base-100 border border-base-300">
						<div className="card-body gap-3">
							<h3 className="card-title">Self-hosted</h3>
							<ul className="text-sm text-base-content/70 space-y-1">
								<li>Your own Supabase project</li>
								<li>Your data never leaves your control</li>
								<li>Deploy anywhere static</li>
							</ul>
							<a
								href={SELF_HOST_URL}
								target="_blank"
								rel="noreferrer"
								className="btn btn-outline btn-sm mt-2 w-fit"
							>
								Self-host guide →
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
