import { useEffect, useRef, useState } from "react";
import { useReconnect } from "../providers/SpacetimeDBProvider";
import { useToast } from "../providers/ToastProvider";

const OVERLAY_DELAY_MS = 5_000;

export function ConnectionStatus() {
	const { status, retryNow } = useReconnect();
	const { addToast } = useToast();
	const wasDisconnectedRef = useRef(false);
	const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [showOverlay, setShowOverlay] = useState(false);

	// Track transitions
	useEffect(() => {
		if (status === "reconnecting" && !wasDisconnectedRef.current) {
			// Just disconnected — show toast
			wasDisconnectedRef.current = true;
			addToast({
				type: "warning",
				message: "Reconnecting to server...",
				duration: OVERLAY_DELAY_MS,
			});

			// After delay, escalate to overlay
			overlayTimerRef.current = setTimeout(() => setShowOverlay(true), OVERLAY_DELAY_MS);
		}

		if (status === "disconnected") {
			wasDisconnectedRef.current = true;
			setShowOverlay(true);
			if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
		}

		if (status === "connected" && wasDisconnectedRef.current) {
			// Reconnected — dismiss overlay and show success toast
			wasDisconnectedRef.current = false;
			setShowOverlay(false);
			if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
			addToast({ type: "success", message: "Reconnected", duration: 2000 });
		}

		return () => {
			if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
		};
	}, [status, addToast]);

	if (!showOverlay) return null;

	const isReconnecting = status === "reconnecting";
	return (
		<div className="fixed inset-0 z-[9998] flex items-center justify-center bg-base-100/80 backdrop-blur-sm">
			<div className="card bg-base-200 shadow-xl p-8 text-center max-w-sm mx-4">
				{isReconnecting && <span className="loading loading-spinner loading-lg mx-auto mb-4" />}
				<h2 className="text-lg font-semibold mb-2">
					{isReconnecting ? "Connection lost" : "Unable to connect"}
				</h2>
				<p className="text-sm text-base-content/60 mb-4">
					{isReconnecting ? "Reconnecting to server..." : "Please check your internet connection."}
				</p>
				<button type="button" className="btn btn-primary" onClick={retryNow}>
					{isReconnecting ? "Retry now" : "Try again"}
				</button>
			</div>
		</div>
	);
}
