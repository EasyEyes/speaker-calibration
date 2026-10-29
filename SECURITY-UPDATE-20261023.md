# Security update: 2026-10-23

Node.js 24.22.1 is selected in `.nvmrc` and `engines.node`. This includes the October 21 security patches. Application source behavior is unchanged except for required build integration configuration.

Source: [Node.js October security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

## Verification and limitations

Production webpack build passes on Node 24. Jest exits with no tests found; the repository has no matching test files.

Native npm audit: 0 critical, 43 high, 11 moderate, 7 low findings. Counts represent affected dependency packages, not unique CVEs.

Remaining findings are deferred to a separate compatibility/reachability review by 2026-10-30. High findings are not claimed fixed or harmless. Many are inherited from braces/micromatch, test tooling, development servers, or discontinued packages; runtime exposure must be assessed before release.

| Package | Severity | Remediation status | Advisory |
| --- | --- | --- | --- |
| `@firebase/firestore` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@firebase/firestore-compat` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@grpc/grpc-js` | high | Requires declared-range/major change | [@grpc/grpc-js: In certain configurations, getAuthContext can return unauthorized certificates as though they were authorized](https://github.com/advisories/GHSA-m9gg-hp2v-232j); [@grpc/grpc-js: The server transmits some error messages thrown by method handlers to the client in status messages](https://github.com/advisories/GHSA-f596-whhp-79r4) |
| `@jest/console` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/core` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/environment` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/fake-timers` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/globals` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/reporters` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/test-result` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/test-sequencer` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `@jest/transform` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `babel-jest` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `braces` | high | Requires declared-range/major change | [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| `chokidar` | high | Native fix reported; further targeted validation required | Inherited from vulnerable dependency |
| `del` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `expect` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `fast-glob` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `firebase` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `globby` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-circus` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-cli` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-config` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-environment-jsdom` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-environment-node` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-haste-map` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-jasmine2` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-message-util` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-resolve` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-resolve-dependencies` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-runner` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-runtime` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-snapshot` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `jest-watcher` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `micromatch` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `nodemon` | high | Native fix reported; further targeted validation required | Inherited from vulnerable dependency |
| `np` | high | Requires declared-range/major change | Inherited from vulnerable dependency |
| `semver` | high | Native fix reported; further targeted validation required | [semver vulnerable to Regular Expression Denial of Service](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw) |
| `simple-update-notifier` | high | Native fix reported; further targeted validation required | Inherited from vulnerable dependency |
| `tmp` | high | Requires declared-range/major change | [tmp allows arbitrary temporary file / directory write via symbolic link `dir` parameter](https://github.com/advisories/GHSA-52f5-9888-hmc6); [tmp has Path Traversal via unsanitized prefix/postfix that enables directory escape](https://github.com/advisories/GHSA-ph9p-34f9-6g65) |
| `ws` | high | Native fix reported; further targeted validation required | [ws: Uninitialized memory disclosure](https://github.com/advisories/GHSA-58qx-3vcg-4xpx); [ws: Memory exhaustion DoS from tiny fragments and data chunks](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) |
| `xlsx` | high | No native fix available | [Prototype Pollution in sheetJS](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6); [SheetJS Regular Expression Denial of Service (ReDoS)](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) |

## Verification scenario

Use the pinned Node version. Install from the authoritative lockfile with dependency scripts disabled first, review native/postinstall scripts, and run only those required by the package. Run the documented test/build commands. Repeat the native audit before release. In a preview, exercise the package's normal entry point and check browser/server errors. A successful build does not prove production integration.
