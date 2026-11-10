import { compose, fail, readBackendEnvironment } from "./common.mjs";

try {
	const action = process.argv[2] ?? "up";
	const env = readBackendEnvironment();
	if (action === "up") {
		compose(["--profile", "api", "up", "-d", "--build", "api"], { env });
	} else if (action === "smoke-up") {
		compose(
			["--profile", "api", "--profile", "smoke", "up", "-d", "--build", "api", "api-second"],
			{ env },
		);
	} else if (action === "stop") {
		compose(["--profile", "api", "--profile", "smoke", "stop"], { env });
	} else {
		throw new Error("Use up, smoke-up, or stop.");
	}
} catch (error) {
	fail(error);
}
