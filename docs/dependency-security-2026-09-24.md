# Dependabot remediation, 2026-09-24

Reviewed all 21 open alerts from
https://github.com/notomate/notomate/security/dependabot.
Seventeen alerts have patched dependency versions in this change. Four Docker
alerts remain in the upstream test dependency graph; they must not be reported
as fully fixed or automatically dismissed.

| Alerts | Dependency | Resolved version |
| --- | --- | --- |
| 180 | js-yaml | 4.3.2 |
| 175, 173 | @tiptap/core | 3.31.3, with matching Tiptap packages |
| 174 | @humanfs/node | 0.16.8 |
| 171 | browserslist | 4.29.1 |
| 170 | postcss-selector-parser | 6.1.4 |
| 59 | uuid via @fortune-sheet/core | 11.1.1, scoped override |
| 144 | protobufjs in collab | 7.6.6 |
| 179, 178, 177, 176, 169, 168 | google.golang.org/grpc in API and runner | 1.83.1 |
| 167 | github.com/moby/go-archive | 0.3.0 |
| 165, 164 | github.com/go-git/go-git/v5 | 5.19.2 |

The uuid override retains CommonJS support and Fortune Sheet's `v4()` API.
act v0.2.89 needs a small source compatibility patch to build with go-archive
v0.3.0. See [the local act copy's maintenance notes](../runner/third_party/act/README.notomate.md).
CI uses `npm ci` to validate the committed frontend lockfile and runs the archive
compatibility regression test. The runner Docker build includes the local act copy.

## Remaining upstream Docker alerts

Alerts [138](https://github.com/notomate/notomate/security/dependabot/138),
[137](https://github.com/notomate/notomate/security/dependabot/137),
[136](https://github.com/notomate/notomate/security/dependabot/136), and
[134](https://github.com/notomate/notomate/security/dependabot/134) concern
`github.com/docker/docker`. GitHub reports no first patched version for this
legacy module. Its published versions end at `v28.5.2+incompatible`.

Updating migrate to v4.20.1 and running `go mod tidy` removes the explicit Docker
requirement from `api/go.mod`, but **does not eliminate it from the module graph**.
`api/go.sum` still legitimately contains its checksums. `go mod why -m` reports:

```text
github.com/notomate/notomate/internal/bootstrap
github.com/golang-migrate/migrate/v4/database/postgres
github.com/golang-migrate/migrate/v4/database/postgres.test
github.com/dhui/dktest
github.com/docker/docker/api/types/container
```

`go list -deps -test ./...` in `api` contains no `github.com/docker/docker`
packages: the dependency belongs to upstream migration-driver tests, not the
API production build or this repository's tests. This limits applicability but
is not an upstream vulnerability fix. Follow up when migrate/dktest removes
the legacy dependency; do not delete checksum lines to hide it.

## Validation

- Frontend TypeScript/Vite production build passed.
- Frontend and collab `npm audit` reported zero vulnerabilities.
- API `go test ./...` and `go vet ./...` passed.
- Runner `go test ./...` (compilation; no existing tests) and `go vet ./...` passed.
- Runner Linux build with `CGO_ENABLED=0` passed.
- API and runner `go mod verify` passed.
- Local act Docker archive regression test passed, including `-race`: uncompressed tar output,
  Dockerfile inclusion, and `.dockerignore` filtering.
- Compared all 77 copied act production Go files against v0.2.89; only
  `pkg/container/docker_build.go` differs.

These are local results. GitHub alert status has not been changed; it can only
be reassessed after the changes reach the repository's default branch.
