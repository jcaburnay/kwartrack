import { fail, localEnvironment } from "../infra/common.mjs";
import { authSettings, CognitoError, cognito } from "./cognito.mjs";
import { checkOwnership, fixtureUsers, seedFixtures } from "./fixtures.mjs";

try {
	if (!process.argv.includes("--confirm-local-auth-data-loss")) {
		throw new Error("Reset replaces fixture identities. Add --confirm-local-auth-data-loss.");
	}
	localEnvironment();
	const settings = authSettings();
	checkOwnership(settings);
	console.log(
		"Reset selects only Alice/Bob in the checked local project pool. Their old subject mappings will not be relinked or deleted.",
	);
	for (const Username of fixtureUsers) {
		try {
			cognito("admin-delete-user", { UserPoolId: settings.poolId, Username });
		} catch (error) {
			if (!(error instanceof CognitoError) || error.code !== "UserNotFoundException") throw error;
		}
	}
	seedFixtures(settings);
	console.log("Recreated fixture identities; old application ownership remains separate.");
} catch (error) {
	fail(error);
}
