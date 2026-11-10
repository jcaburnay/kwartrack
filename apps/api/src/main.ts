import { Logger } from "@nestjs/common";
import { createApplication } from "./application.js";
import { readLocalConfig } from "./config/local-config.js";

async function bootstrap() {
	const config = readLocalConfig(process.env);
	const app = await createApplication(config);
	await app.listen(config.port, config.host);
}

bootstrap().catch((error: unknown) => {
	const message =
		error instanceof Error && error.message.startsWith("Invalid local configuration:")
			? error.message
			: "API startup failed";
	Logger.error(message, "Bootstrap");
	process.exitCode = 1;
});
