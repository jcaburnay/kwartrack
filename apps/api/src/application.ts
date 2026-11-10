import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";
import { type LocalConfig, readLocalConfig } from "./config/local-config.js";

export async function createApplication(config: LocalConfig = readLocalConfig(process.env)) {
	const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config));
	app.disable("x-powered-by");
	app.set("trust proxy", false);
	const logger = new Logger("HTTP");
	app.use((req: Request, res: Response, next: NextFunction) => {
		const started = performance.now();
		const suppliedId = req.get("x-request-id");
		const requestId =
			suppliedId && /^[a-zA-Z0-9_-]{1,80}$/.test(suppliedId) ? suppliedId : randomUUID();
		res.setHeader("X-Request-Id", requestId);
		res.setHeader("X-Api-Instance", config.instanceId);
		res.on("finish", () => {
			logger.log(
				JSON.stringify({
					requestId,
					method: req.method,
					status: res.statusCode,
					durationMs: Math.round(performance.now() - started),
				}),
			);
		});
		next();
	});
	const document = SwaggerModule.createDocument(
		app,
		new DocumentBuilder().setTitle("Kwartrack Local API").setVersion("1.0.3").build(),
	);
	SwaggerModule.setup("docs", app, document);
	app.enableShutdownHooks();
	return app;
}
