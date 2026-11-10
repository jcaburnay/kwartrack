export type LocalConfig = Readonly<{
	host: string;
	port: number;
	databaseUrl: string | undefined;
	awsEndpoint: string;
	awsRegion: string;
	instanceId: string;
}>;

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]", "floci"]);

function invalid(field: string): never {
	throw new Error(`Invalid local configuration: ${field}`);
}

function localUrl(value: string, field: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return invalid(field);
	}
	if (!localHosts.has(url.hostname) || url.search || url.hash) invalid(field);
	return url;
}

export function readLocalConfig(env: NodeJS.ProcessEnv): LocalConfig {
	if (env.APP_ENV !== "local") invalid("APP_ENV (must be local)");
	for (const name of ["AWS_PROFILE", "AWS_DEFAULT_PROFILE", "AWS_SESSION_TOKEN"]) {
		if (env[name]) invalid(name);
	}
	for (const name of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
		if (env[name] && env[name] !== "test") invalid(name);
	}
	const host = env.API_HOST ?? "127.0.0.1";
	if (!["127.0.0.1", "0.0.0.0", "::1"].includes(host)) invalid("API_HOST");
	const portText = env.API_PORT ?? "3000";
	const port = Number(portText);
	if (!/^\d+$/.test(portText) || port < 1 || port > 65535) invalid("API_PORT");
	const awsEndpoint = env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566";
	const awsUrl = localUrl(awsEndpoint, "AWS_ENDPOINT_URL");
	if (
		awsUrl.protocol !== "http:" ||
		awsUrl.port !== "4566" ||
		awsUrl.username ||
		awsUrl.password ||
		awsUrl.pathname !== "/"
	)
		invalid("AWS_ENDPOINT_URL");
	const awsRegion = env.AWS_REGION ?? "us-east-1";
	if (awsRegion !== "us-east-1") invalid("AWS_REGION");
	const databaseUrl = env.DATABASE_URL || undefined;
	if (databaseUrl) {
		const dbUrl = localUrl(databaseUrl, "DATABASE_URL");
		if (
			!["postgresql:", "postgres:"].includes(dbUrl.protocol) ||
			!/^\/kwartrack_api(?:_test_[a-z0-9_]+)?$/.test(dbUrl.pathname) ||
			!dbUrl.port ||
			Number(dbUrl.port) < 7001 ||
			Number(dbUrl.port) > 7099
		)
			invalid("DATABASE_URL");
	}
	const instanceId = env.API_INSTANCE_ID ?? "api-local";
	if (!/^[a-zA-Z0-9_-]{1,50}$/.test(instanceId)) invalid("API_INSTANCE_ID");
	return Object.freeze({ host, port, databaseUrl, awsEndpoint, awsRegion, instanceId });
}
