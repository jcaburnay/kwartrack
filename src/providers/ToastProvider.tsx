// src/providers/ToastProvider.tsx
import { createContext, useCallback, useContext, useRef, useState } from "react";

interface Toast {
	id: string;
	type: "error" | "success" | "warning" | "info";
	message: string;
	duration: number;
}

interface ToastContextValue {
	addToast: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used within ToastProvider");
	return ctx;
}

const DEFAULT_DURATIONS: Record<Toast["type"], number> = {
	success: 4000,
	info: 4000,
	warning: 6000,
	error: 6000,
};

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const counterRef = useRef(0);

	const addToast = useCallback((input: Omit<Toast, "id" | "duration"> & { duration?: number }) => {
		const id = `toast-${++counterRef.current}`;
		const duration = input.duration ?? DEFAULT_DURATIONS[input.type];
		const toast: Toast = { ...input, id, duration };

		setToasts((prev) => {
			const next = [...prev, toast];
			return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
		});

		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, duration);
	}, []);

	const alertClass: Record<Toast["type"], string> = {
		error: "alert-error",
		success: "alert-success",
		warning: "alert-warning",
		info: "alert-info",
	};

	return (
		<ToastContext.Provider value={{ addToast }}>
			{children}
			<div className="toast toast-end toast-bottom z-[9999] max-md:toast-center">
				{toasts.map((t) => (
					<div key={t.id} className={`alert ${alertClass[t.type]} text-sm shadow-lg`}>
						<span>{t.message}</span>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
