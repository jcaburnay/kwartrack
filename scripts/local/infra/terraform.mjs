import { fail, terraform } from "./common.mjs";

try {
	const args = process.argv.slice(2);
	if (!["init", "validate", "fmt", "plan", "apply", "output", "destroy"].includes(args[0])) {
		throw new Error("Use init, validate, fmt, plan, apply, output, or destroy.");
	}
	if (args[0] === "destroy") {
		const confirmation = args.indexOf("--confirm-local-data-loss");
		if (confirmation === -1)
			throw new Error("Destroy removes local experiment resources. Add --confirm-local-data-loss.");
		args.splice(confirmation, 1);
	}
	terraform(args);
} catch (error) {
	fail(error);
}
