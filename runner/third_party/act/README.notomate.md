# Temporary act compatibility patch

Source: https://github.com/nektos/act/tree/v0.2.89
Commit: `4f411281417e88660bea1c1a1749aa71ae0bd60f`.

This directory contains the upstream production `pkg` Go sources, their four
embedded assets, and the upstream MIT license. The CLI, upstream tests and test
fixtures are omitted. The module dependencies are aligned with the runner and
tidied for this library subset.

The only production source change is in `pkg/container/docker_build.go`: import
`github.com/moby/go-archive/compression` and use its `None` constant.
act v0.2.89 still references `archive.Uncompressed`, removed in go-archive v0.3.0.
Keeping go-archive at v0.3.0 or newer fixes the archive extraction vulnerability
tracked by https://github.com/notomate/notomate/security/dependabot/167.

`runner/go.mod` temporarily replaces act with this directory so normal Go builds,
tests and Docker builds all use the compatibility fix without changing module
caches or adding a build-time patch step.

The local `docker_build_compat_test.go` regression test verifies uncompressed
Docker build contexts, Dockerfile inclusion, and `.dockerignore` filtering.
Run it with `go -C third_party/act test ./pkg/container` from the runner directory;
the runner CI job also runs it.

When an upstream act release supports go-archive v0.3.0 or newer, upgrade act,
remove the replace directive and this directory, run `go mod tidy`, and test the
runner on Windows and Linux. Keep the patched go-archive version when upgrading.
