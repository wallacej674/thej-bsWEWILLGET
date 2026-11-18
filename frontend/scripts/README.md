# Dependency audit

Run `npm run audit:dependencies` from `frontend` to apply the same audit policy as CI.
The full npm audit report is retained in the output. High and critical findings
fail the check, including failures to fetch or interpret the audit report.

## Approved exception

On November 17, 2026, the project owner approved accepting
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), a
picomatch regular expression denial of service advisory with no patched release
available at approval. It also affects the existing main lockfile. The affected
copies are used by the frontend build, lint, and test tools. Their glob patterns
come from project configuration and source files. The residual risk is excessive
CPU use if those tools process a malicious extglob pattern.

The exception matches that advisory URL and picomatch only, including findings
that propagate through dependent packages. Every affected copy must be marked
as a development dependency in the committed lockfile. A production copy,
another advisory on picomatch, or another high/critical finding fails CI.

When a patched release is available, update the dependency tree and remove the
exception from `audit-policy.mjs`. Run `npm run test:audit` to verify the policy,
then `npm run audit:dependencies` against the actual dependencies.
