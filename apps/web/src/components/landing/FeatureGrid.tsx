import { FEATURES } from "./content";

export function FeatureGrid() {
	return (
		<section id="features" className="mx-auto max-w-6xl px-4 py-16">
			<h2 className="mb-8 text-center text-2xl font-semibold sm:text-3xl">
				Everything your money does, in one place
			</h2>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{FEATURES.map((feature) => {
					const Icon = feature.icon;
					return (
						<div key={feature.title} className="card bg-base-100 border border-base-300">
							<div className="card-body gap-2">
								<Icon className="size-6 text-primary" />
								<h3 className="card-title text-base">{feature.title}</h3>
								<p className="text-sm text-base-content/70">{feature.body}</p>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
