# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.0] - 2020-07-24

### Changed

- Remove `async` and `promise-to-callback` dependencies
  - These dependencies were used internally for asynchronous control flow.
  They have been replaced with Promises and native `async`/`await`.
  This has introduced subtle timing differences during middleware execution, but none that should affect consumers.
