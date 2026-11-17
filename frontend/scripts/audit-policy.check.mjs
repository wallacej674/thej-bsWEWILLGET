import assert from "node:assert/strict";
import test from "node:test";

import { auditFailures } from "./audit-policy.mjs";

const path = "node_modules/vite/node_modules/picomatch";
const advisory = {
  name: "picomatch",
  severity: "high",
  url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
};
const lockfile = { packages: { [path]: { dev: true } } };

function report(via = [advisory]) {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      picomatch: { severity: "high", via, nodes: [path] },
      vite: { severity: "high", via: ["picomatch"] },
    },
  };
}

test("accepts only the approved development advisory and its dependency paths", () => {
  assert.deepEqual(auditFailures(report(), lockfile), []);
});

test("blocks another advisory on the same package and its dependents", () => {
  assert.deepEqual(
    auditFailures(report([advisory, { ...advisory, url: "https://github.com/advisories/GHSA-other" }]), lockfile),
    ["picomatch", "vite"],
  );
});

test("blocks a separate high or critical vulnerability", () => {
  for (const severity of ["high", "critical"]) {
    const audit = report();
    audit.vulnerabilities.other = { severity, via: [{ name: "other", severity, url: "other" }] };
    assert.deepEqual(auditFailures(audit, lockfile), ["other"]);
  }
});

test("does not extend the exception to critical severity or another package", () => {
  for (const cause of [{ ...advisory, severity: "critical" }, { ...advisory, name: "other" }]) {
    assert.deepEqual(auditFailures(report([cause]), lockfile), ["picomatch", "vite"]);
  }
});

test("blocks the approved advisory if a copy is a production dependency or missing", () => {
  for (const packages of [{ [path]: { dev: false } }, {}]) {
    assert.deepEqual(auditFailures(report(), { packages }), ["picomatch", "vite"]);
  }
});

test("blocks missing or circular dependency information", () => {
  for (const via of [["missing"], ["vite"], []]) {
    assert.deepEqual(auditFailures(report(via), lockfile), ["picomatch", "vite"]);
  }
});

test("rejects failed and unsupported audit responses", () => {
  assert.throws(() => auditFailures({ error: { message: "network error" } }, lockfile));
  assert.throws(() => auditFailures({ auditReportVersion: 1 }, lockfile));
  const audit = report();
  audit.vulnerabilities.picomatch.severity = "unknown";
  assert.throws(() => auditFailures(audit, lockfile));
});

test("accepts a clean audit", () => {
  assert.deepEqual(auditFailures({ auditReportVersion: 2, vulnerabilities: {} }, lockfile), []);
});

test("retains the existing high severity threshold for moderate advisories", () => {
  assert.deepEqual(auditFailures(report([{ ...advisory, severity: "moderate", url: "other" }]), lockfile), []);
});
