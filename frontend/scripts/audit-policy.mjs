const approvedAdvisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const blockingSeverities = new Set(["high", "critical"]);
const nonBlockingSeverities = new Set(["info", "low", "moderate"]);

export function auditFailures(report, lockfile) {
  if (
    report.error ||
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== "object" ||
    Array.isArray(report.vulnerabilities) ||
    !lockfile.packages
  ) {
    throw new Error("Unsupported or unsuccessful npm audit response.");
  }

  for (const vulnerability of Object.values(report.vulnerabilities)) {
    if (
      !vulnerability ||
      (!blockingSeverities.has(vulnerability.severity) &&
        !nonBlockingSeverities.has(vulnerability.severity))
    ) {
      throw new Error("Unsupported vulnerability severity in npm audit response.");
    }
  }

  function accepted(name, ancestors = new Set()) {
    const vulnerability = report.vulnerabilities[name];
    if (
      !vulnerability ||
      ancestors.has(name) ||
      !Array.isArray(vulnerability.via) ||
      vulnerability.via.length === 0
    ) {
      return false;
    }

    const visited = new Set([...ancestors, name]);
    return vulnerability.via.every((cause) => {
      if (typeof cause === "string") return accepted(cause, visited);
      if (!cause || !cause.severity) return false;
      if (nonBlockingSeverities.has(cause.severity)) return true;

      // Approved November 17, 2026. The exception covers build/test copies only.
      return (
        name === "picomatch" &&
        cause.name === "picomatch" &&
        cause.url === approvedAdvisory &&
        cause.severity === "high" &&
        Array.isArray(vulnerability.nodes) &&
        vulnerability.nodes.length > 0 &&
        vulnerability.nodes.every((path) => lockfile.packages[path]?.dev === true)
      );
    });
  }

  return Object.entries(report.vulnerabilities)
    .filter(([, vulnerability]) => blockingSeverities.has(vulnerability.severity))
    .filter(([name]) => !accepted(name))
    .map(([name]) => name);
}
