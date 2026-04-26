type Props = {
	onCreateAccount: () => void;
};

export function WelcomeCard({ onCreateAccount }: Props) {
	return (
		<div className="card bg-base-100 shadow-md max-w-xl w-full mx-auto">
			<div className="card-body items-center text-center gap-4 py-10">
				<h2 className="card-title text-2xl">Welcome to Kwartrack 👋</h2>
				<p className="text-base-content/70 max-w-sm">
					Get started by creating your first account. Cash, e-wallet, savings, credit card, or time
					deposit — your choice.
				</p>
				<button type="button" className="btn btn-primary mt-2" onClick={onCreateAccount}>
					+ Create Account
				</button>
			</div>
		</div>
	);
}
