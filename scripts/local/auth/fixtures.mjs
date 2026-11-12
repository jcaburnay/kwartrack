import { CognitoError, cognito } from "./cognito.mjs";

export const fixtureUsers = ["alice@kwartrack.local", "bob@kwartrack.local"];
export const fixturePassword = "LocalOnly9!Kwartrack";

export function validateOwnedPool(settings, pool, client) {
	if (
		pool?.Id !== settings.poolId ||
		pool.Name !== "kwartrack-api-local" ||
		pool.UserPoolTags?.project !== "kwartrack-backend-local"
	) {
		throw new Error("Fixture operations require the owned pool.");
	}
	const flows = [...(client?.ExplicitAuthFlows ?? [])].sort();
	if (
		client?.UserPoolId !== settings.poolId ||
		client.ClientId !== settings.clientId ||
		client.ClientName !== "kwartrack-api-local-public" ||
		client.ClientSecret ||
		JSON.stringify(flows) !==
			JSON.stringify(["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"])
	) {
		throw new Error("Fixture operations require the owned public client.");
	}
}

export function checkOwnership(settings) {
	const pool = cognito("describe-user-pool", { UserPoolId: settings.poolId }).UserPool;
	const client = cognito("describe-user-pool-client", {
		UserPoolId: settings.poolId,
		ClientId: settings.clientId,
	}).UserPoolClient;
	validateOwnedPool(settings, pool, client);
	return client;
}

export function fixtureSubjects(settings) {
	return Object.fromEntries(
		fixtureUsers.map((Username) => {
			const user = cognito("admin-get-user", { UserPoolId: settings.poolId, Username });
			const sub = user.UserAttributes?.find((attribute) => attribute.Name === "sub")?.Value;
			if (!/^[0-9a-f-]{36}$/.test(sub ?? ""))
				throw new Error("Fixture subject is missing or invalid.");
			return [Username, sub];
		}),
	);
}

export function seedFixtures(settings) {
	checkOwnership(settings);
	for (const Username of fixtureUsers) {
		let user;
		try {
			user = cognito("admin-get-user", { UserPoolId: settings.poolId, Username });
		} catch (error) {
			if (!(error instanceof CognitoError) || error.code !== "UserNotFoundException") throw error;
			user = cognito("admin-create-user", {
				UserPoolId: settings.poolId,
				Username,
				MessageAction: "SUPPRESS",
				UserAttributes: [
					{ Name: "email", Value: Username },
					{ Name: "email_verified", Value: "true" },
				],
			}).User;
		}
		if (user.UserStatus === "FORCE_CHANGE_PASSWORD") {
			cognito("admin-set-user-password", {
				UserPoolId: settings.poolId,
				Username: user.Username,
				Password: fixturePassword,
				Permanent: true,
			});
		}
	}
	return fixtureSubjects(settings);
}
