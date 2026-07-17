export type PersonValidation = { ok: true } | { ok: false; message: string };

export function validatePerson(name: string): PersonValidation {
	const trimmed = name.trim();
	if (trimmed.length === 0) return { ok: false, message: "Name is required" };
	if (trimmed.length > 80) return { ok: false, message: "Name must be 80 characters or fewer" };
	return { ok: true };
}
