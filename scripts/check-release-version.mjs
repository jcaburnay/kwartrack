import { readFile } from "node:fs/promises";

const repositoryRoot = new URL("../", import.meta.url);
const packageFiles = [
	["workspace", "package.json"],
	["web", "apps/web/package.json"],
	["MCP", "apps/mcp/package.json"],
];

const versions = await Promise.all(
	packageFiles.map(async ([name, path]) => {
		const contents = await readFile(new URL(path, repositoryRoot), "utf8");
		const manifest = JSON.parse(contents);
		return [name, manifest.version];
	}),
);

const expectedVersion = versions[0][1];
const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (typeof expectedVersion !== "string" || !stableSemver.test(expectedVersion)) {
	throw new Error(`Workspace version must be stable SemVer (x.y.z); received ${expectedVersion}.`);
}

for (const [name, version] of versions) {
	if (version !== expectedVersion) {
		throw new Error(`${name} package version ${version} does not match ${expectedVersion}.`);
	}
}

const mcpTools = await readFile(new URL("apps/mcp/src/tools.ts", repositoryRoot), "utf8");
if (!mcpTools.includes(`{ name: "kwartrack", version: "${expectedVersion}" }`)) {
	throw new Error(`MCP server metadata does not match release version ${expectedVersion}.`);
}

console.log(`Release version ${expectedVersion} is aligned.`);
