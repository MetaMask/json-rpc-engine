# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [7.0.0]
### Uncategorized
- Add scripts from module template ([#143](https://github.com/MetaMask/json-rpc-engine/pull/143))
- Revert "7.0.0" ([#142](https://github.com/MetaMask/json-rpc-engine/pull/142))
- 7.0.0 ([#141](https://github.com/MetaMask/json-rpc-engine/pull/141))
- Update README ([#140](https://github.com/MetaMask/json-rpc-engine/pull/140))
- Use `@metamask/rpc-errors` ([#138](https://github.com/MetaMask/json-rpc-engine/pull/138))
- BREAKING: Update dependencies, fix code style, and standardise workflows ([#139](https://github.com/MetaMask/json-rpc-engine/pull/139))
- Bump @metamask/utils from 2.1.0 to 5.0.1 ([#136](https://github.com/MetaMask/json-rpc-engine/pull/136))
- Bump json5 from 1.0.1 to 1.0.2 ([#129](https://github.com/MetaMask/json-rpc-engine/pull/129))
- Bump minimatch from 3.0.4 to 3.1.2 ([#126](https://github.com/MetaMask/json-rpc-engine/pull/126))
- Bump @metamask/auto-changelog from 3.0.0 to 3.1.0 ([#125](https://github.com/MetaMask/json-rpc-engine/pull/125))
- Bump @metamask/auto-changelog from 2.6.1 to 3.0.0 ([#122](https://github.com/MetaMask/json-rpc-engine/pull/122))
- Handle JSON-RPC notifications ([#104](https://github.com/MetaMask/json-rpc-engine/pull/104))
- Bump @metamask/utils from 2.0.0 to 2.1.0 ([#113](https://github.com/MetaMask/json-rpc-engine/pull/113))
- Bump @metamask/auto-changelog from 2.5.0 to 2.6.1 ([#111](https://github.com/MetaMask/json-rpc-engine/pull/111))
- Rename engine test file ([#108](https://github.com/MetaMask/json-rpc-engine/pull/108))
- Add `destroy` method ([#106](https://github.com/MetaMask/json-rpc-engine/pull/106))
- BREAKING: Use @metamask/utils ([#105](https://github.com/MetaMask/json-rpc-engine/pull/105))
- Migrate to Jest ([#102](https://github.com/MetaMask/json-rpc-engine/pull/102))
- Improve module template compliance ([#100](https://github.com/MetaMask/json-rpc-engine/pull/100))
- Bump ajv from 6.10.2 to 6.12.6 ([#101](https://github.com/MetaMask/json-rpc-engine/pull/101))
- Bump minimist from 1.2.5 to 1.2.6 ([#99](https://github.com/MetaMask/json-rpc-engine/pull/99))
- Bump path-parse from 1.0.6 to 1.0.7 ([#95](https://github.com/MetaMask/json-rpc-engine/pull/95))
- Bump glob-parent from 5.0.0 to 5.1.2 ([#93](https://github.com/MetaMask/json-rpc-engine/pull/93))
- Update ESLint and TypeScript dependencies and config ([#90](https://github.com/MetaMask/json-rpc-engine/pull/90))
- Bump hosted-git-info from 2.8.7 to 2.8.9 ([#88](https://github.com/MetaMask/json-rpc-engine/pull/88))
- Bump lodash from 4.17.19 to 4.17.21 ([#87](https://github.com/MetaMask/json-rpc-engine/pull/87))
- Repo standardization ([#86](https://github.com/MetaMask/json-rpc-engine/pull/86))
- Bump y18n from 4.0.0 to 4.0.1 ([#85](https://github.com/MetaMask/json-rpc-engine/pull/85))
- resolve() function argument was missing in Promise definition ([#79](https://github.com/MetaMask/json-rpc-engine/pull/79))

### Added
- `isJsonRpcSuccess` and `isJsonRpcFailure` type guard utilities ([#91](https://github.com/MetaMask/json-rpc-engine/pull/91))
- JSON-RPC ID validation utility and type guard, via `getJsonRpcIdValidator` ([#91](https://github.com/MetaMask/json-rpc-engine/pull/91))

### Changed
- **(BREAKING)** Return a `null` instead of `undefined` response `id` for malformed request objects ([#91](https://github.com/MetaMask/json-rpc-engine/pull/91))
  - This is very unlikely to be breaking in practice, but the behavior could have been relied on.

## [6.1.0] - 2020-11-20
### Added
- Add `PendingJsonRpcResponse` interface for use in middleware ([#75](https://github.com/MetaMask/json-rpc-engine/pull/75))

### Changed
- Use `async`/`await` and `try`/`catch` instead of Promise methods everywhere ([#74](https://github.com/MetaMask/json-rpc-engine/pull/74))
  - Consumers may notice improved stack traces on certain platforms.

## [6.0.0] - 2020-11-19
### Added
- Add docstrings for public `JsonRpcEngine` methods ([#70](https://github.com/MetaMask/json-rpc-engine/pull/70))

### Changed
- **(BREAKING)** Refactor exports ([#69](https://github.com/MetaMask/json-rpc-engine/pull/69))
  - All exports are now named, and available via the package entry point.
  - All default exports have been removed.
- **(BREAKING)** Convert `asMiddleware` to instance method ([#69](https://github.com/MetaMask/json-rpc-engine/pull/69))
  - The `asMiddleware` export has been removed.
- **(BREAKING)** Add runtime typechecks to `JsonRpcEngine.handle()`, and error responses if they fail ([#70](https://github.com/MetaMask/json-rpc-engine/pull/70))
  - Requests will now error if:
    - The request is not a plain object, or if the `method` property is not a `string`. Empty strings are allowed.
    - A `next` middleware callback is called with a truthy, non-function parameter.
- Migrate to TypeScript ([#69](https://github.com/MetaMask/json-rpc-engine/pull/69))
- Hopefully improve stack traces by removing uses of `Promise.then` and `.catch` internally ([#70](https://github.com/MetaMask/json-rpc-engine/pull/70))
- Make some internal `JsonRpcEngine` methods `static` ([#71](https://github.com/MetaMask/json-rpc-engine/pull/71))

## [5.4.0] - 2020-11-07
### Changed
- Make the TypeScript types not terrible ([#66](https://github.com/MetaMask/json-rpc-engine/pull/66), [#67](https://github.com/MetaMask/json-rpc-engine/pull/67))

## [5.3.0] - 2020-07-30
### Changed
- Response object errors no longer include a `stack` property

## [5.2.0] - 2020-07-24
### Added
- Promise signatures for `engine.handle` ([#55](https://github.com/MetaMask/json-rpc-engine/pull/55))
  - So, in addition to `engine.handle(request, callback)`, you can do e.g. `await engine.handle(request)`.

### Changed
- Remove `async` and `promise-to-callback` dependencies
  - These dependencies were used internally for middleware flow control.
    They have been replaced with Promises and native `async`/`await`, which means that some operations are _no longer_ eagerly executed.
    This change may affect consumers that depend on the eager execution of middleware _during_ request processing, _outside of_ middleware functions and request handlers.
    - In general, it is a bad practice to work with state that depends on middleware execution, while the middleware are executing.

[Unreleased]: https://github.com/MetaMask/json-rpc-engine/compare/v7.0.0...HEAD
[7.0.0]: https://github.com/MetaMask/json-rpc-engine/compare/v6.1.0...v7.0.0
[6.1.0]: https://github.com/MetaMask/json-rpc-engine/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/MetaMask/json-rpc-engine/compare/v5.4.0...v6.0.0
[5.4.0]: https://github.com/MetaMask/json-rpc-engine/compare/v5.3.0...v5.4.0
[5.3.0]: https://github.com/MetaMask/json-rpc-engine/compare/v5.2.0...v5.3.0
[5.2.0]: https://github.com/MetaMask/json-rpc-engine/releases/tag/v5.2.0
