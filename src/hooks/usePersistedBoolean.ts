import { useEffect, useState } from "react";

export function usePersistedBoolean(key: string, initial: boolean) {
	const [value, setValue] = useState<boolean>(() => {
		if (typeof window === "undefined") return initial;
		const raw = window.localStorage.getItem(key);
		if (raw === "true") return true;
		if (raw === "false") return false;
		return initial;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(key, String(value));
	}, [key, value]);

	return [value, setValue] as const;
}
