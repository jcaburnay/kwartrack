// src/components/RouteErrorBoundary.tsx

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// biome-ignore lint/suspicious/noConsole: intentional error logging
		console.error("[RouteErrorBoundary]", error, info.componentStack);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex items-center justify-center min-h-[50vh] p-4">
					<div className="card bg-base-200 shadow-lg p-6 text-center max-w-sm">
						<h2 className="text-lg font-semibold mb-2">This page encountered an error</h2>
						<p className="text-sm text-base-content/60 mb-4">
							You can try again or navigate to a different page.
						</p>
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => this.setState({ hasError: false })}
						>
							Try again
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}
