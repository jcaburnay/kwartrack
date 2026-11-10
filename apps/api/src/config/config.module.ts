import { type DynamicModule, Global, Module } from "@nestjs/common";
import type { LocalConfig } from "./local-config.js";

export class ConfigService {
	constructor(readonly values: LocalConfig) {}
}

@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules require a decorated class.
export class ConfigModule {
	static register(config: LocalConfig): DynamicModule {
		return {
			module: ConfigModule,
			providers: [{ provide: ConfigService, useValue: new ConfigService(config) }],
			exports: [ConfigService],
		};
	}
}
