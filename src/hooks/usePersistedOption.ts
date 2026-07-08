import { useEffect, useState } from "react";

export function usePersistedOption<T extends string>(
	key: string,
	initial: T,
	validValues?: readonly T[],
) {
	const [value, setValue] = useState<T>(() => {
		if (typeof window === "undefined") return initial;
		const raw = window.localStorage.getItem(key);
		if (raw && (!validValues || validValues.includes(raw as T))) return raw as T;
		return initial;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(key, value);
	}, [key, value]);

	return [value, setValue] as const;
}
