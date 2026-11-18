import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

import { auditFailures } from "./audit-policy.mjs";

try {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "audit", "--json"],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw result.error ?? new Error(result.stderr || "npm audit could not run.");
  }

  const report = JSON.parse(result.stdout);
  const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const failures = auditFailures(report, lockfile);
  // Retain the full report so the accepted advisory remains visible in CI.
  console.log(result.stdout);
  if (failures.length > 0) {
    console.error(`Unaccepted high/critical vulnerabilities: ${failures.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Audit passed with the documented development-only GHSA-fc5q-39xc-vjpf exception.");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
