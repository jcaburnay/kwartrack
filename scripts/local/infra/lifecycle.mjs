import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { compose, fail, localEnvironment, root, run } from "./common.mjs";

const projectFilter = "label=io.kwartrack.project=kwartrack-backend-local";

function projectContainers() {
	return run("docker", ["ps", "-aq", "--filter", projectFilter], { capture: true })
		.split("\n")
		.filter(Boolean);
}

try {
	localEnvironment();
	const action = process.argv[2];
	if (!["stop", "reset", "status"].includes(action))
		throw new Error("Use stop, status, or reset --confirm-local-data-loss.");
	if (action === "status") {
		compose(["--profile", "api", "--profile", "smoke", "ps"]);
		run("docker", ["ps", "-a", "--filter", projectFilter, "--format", "{{.Names}} {{.Status}}"]);
	} else {
		if (action === "reset" && !process.argv.includes("--confirm-local-data-loss")) {
			throw new Error(
				"Reset destroys only this experiment's local databases and state. Add --confirm-local-data-loss.",
			);
		}
		if (existsSync(`${root}infra/terraform/local/.terraform.tfstate.lock.info`)) {
			throw new Error(
				"Terraform state is locked; finish or diagnose that operation before stopping/resetting.",
			);
		}
		compose(["--profile", "api", "--profile", "smoke", "stop"]);
		const containers = projectContainers();
		if (containers.length) run("docker", ["stop", "--time", "10", ...containers]);
		if (action === "reset") {
			console.log(`Reset selects project containers: ${containers.join(", ") || "none"}`);
			console.log(
				"Reset selects Compose project kwartrack-backend-local and its floci-data volume.",
			);
			console.log(
				"Reset selects infra/terraform/local/{terraform.tfstate,terraform.tfstate.backup,local.auto.tfvars.json} and infra/local/{backend,auth}.env.local.",
			);
			const volumes = run("docker", ["volume", "ls", "-q", "--filter", projectFilter], {
				capture: true,
			})
				.split("\n")
				.filter(Boolean);
			console.log(`Reset selects project backend volumes: ${volumes.join(", ") || "none"}`);
			if (containers.length) run("docker", ["rm", ...containers]);
			compose(["--profile", "api", "--profile", "smoke", "down", "--volumes"]);
			if (volumes.length) run("docker", ["volume", "rm", ...volumes]);
			for (const file of [
				"terraform.tfstate",
				"terraform.tfstate.backup",
				"local.auto.tfvars.json",
			]) {
				rmSync(`${root}infra/terraform/local/${file}`, { force: true });
			}
			const backendFile = `${root}infra/local/backend.env.local`;
			const apiFile = `${root}apps/api/.env.local`;
			if (existsSync(backendFile) && existsSync(apiFile)) {
				const generated = parseEnv(readFileSync(backendFile, "utf8")).API_HOST_DATABASE_URL;
				const apiContents = readFileSync(apiFile, "utf8");
				if (generated && parseEnv(apiContents).DATABASE_URL === generated) {
					writeFileSync(
						apiFile,
						apiContents.replace(/^\s*(?:export\s+)?DATABASE_URL\s*=.*\r?\n?/gm, ""),
						{ mode: 0o600 },
					);
				} else {
					console.log(
						"Preserved the API's independently configured DATABASE_URL; reconcile it before setup.",
					);
				}
			}
			rmSync(`${root}infra/local/backend.env.local`, { force: true });
			rmSync(`${root}infra/local/auth.env.local`, { force: true });
			console.log(
				"Removed the local experiment's resources and state; Supabase and unrelated Docker resources were not selected.",
			);
		} else {
			console.log(
				"Stopped Compose and project-labeled backend containers; state and database volumes are preserved.",
			);
		}
	}
} catch (error) {
	fail(error);
}
