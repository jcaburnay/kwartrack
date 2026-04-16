// src/components/RootErrorBoundary.tsx

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

export class RootErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// biome-ignore lint/suspicious/noConsole: intentional error logging
		console.error("[RootErrorBoundary]", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex items-center justify-center min-h-screen bg-base-100 p-4">
					<div className="card bg-base-200 shadow-xl p-8 text-center max-w-md">
						<h1 className="text-xl font-bold mb-2">Something went wrong</h1>
						<p className="text-sm text-base-content/60 mb-6">
							An unexpected error occurred. Please reload the app to continue.
						</p>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => window.location.reload()}
						>
							Reload app
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
