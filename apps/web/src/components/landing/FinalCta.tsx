import { Link } from "react-router";
import { SELF_HOST_URL } from "./content";

export function FinalCta() {
	return (
		<section className="bg-primary text-primary-content">
			<div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center">
				<h2 className="text-2xl font-semibold sm:text-3xl">Start tracking in two minutes.</h2>
				<div className="flex flex-wrap justify-center gap-3">
					<Link to="/signup" className="btn btn-neutral">
						Create your free account
					</Link>
					<a
						href={SELF_HOST_URL}
						target="_blank"
						rel="noreferrer"
						className="btn btn-ghost border-primary-content/40"
					>
						Self-host guide →
					</a>
				</div>
			</div>
		</section>
	);
}
