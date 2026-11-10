import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import type { LocalConfig } from "./config/local-config.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";

@Module({ controllers: [HealthController], providers: [HealthService] })
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules require a decorated class.
export class AppModule {
	static register(config: LocalConfig): DynamicModule {
		return { module: AppModule, imports: [ConfigModule.register(config), DatabaseModule] };
	}
}
