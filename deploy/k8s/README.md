# Kubernetes deployment

Kustomize base for running notomate on Kubernetes (k3s works out of the box).

```
deploy/k8s/base/   api, collab, messaging, nginx (Deployment + Service each)
```

The base is environment-neutral: no namespace, and the images are the
`notomate/notomate-*` names used by `docker-compose.yml` and the release
workflow. Point it at a namespace and a registry/tag from an overlay or from
your GitOps tool.

The workflow runner (`runner/`) is not included: it drives jobs through the
host's Docker socket, which a containerd-based node doesn't provide. Run it
with `docker-compose.runner.yml` on a Docker host and point
`NM_INSTANCE_ADDR` at the API's gRPC port.

## Required secret

The manifests read `notomate-secrets` from their namespace:

```bash
kubectl -n <namespace> create secret generic notomate-secrets \
  --from-literal=APP_SECRET="$(openssl rand -hex 32)"
  # optional keys: APP_DISABLE_SIGNUP=true, RUNNER_REGISTRATION_TOKEN=...
```

## Deploying a release

```yaml
# kustomization.yaml in your own overlay
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: notomate
resources:
  - https://github.com/notomate/notomate//deploy/k8s/base?ref=v1.2.3
images:
  - name: notomate/notomate-api
    newTag: 1.2.3
  - name: notomate/notomate-collab
    newTag: 1.2.3
  - name: notomate/notomate-messaging
    newTag: 1.2.3
  - name: notomate/notomate-nginx
    newTag: 1.2.3
```

Expose the `notomate-nginx` Service (port 80) through an Ingress or a tunnel;
it serves the SPA and proxies `/api/`, `/ws/` and `/socket.io/` to the other
services. WebSocket support is required.

## Tracking main (staging)

`.github/workflows/main-images.yml` publishes every main commit that passed
CI as `ghcr.io/<owner>/notomate-<svc>:<sha7>` (and `:main`). It is opt-in:
set the repository variable `PUBLISH_MAIN_IMAGES=true`. Packages pushed by
Actions start out private; make them public or give the namespace an image
pull secret.

To roll those images out automatically, e.g. with Argo CD and Argo CD Image
Updater (`argocd` write-back, nothing is committed back to the repo):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: notomate-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<owner>/<repo>
    targetRevision: main
    path: deploy/k8s/base
    kustomize:
      namespace: notomate-staging
      images:
        - notomate/notomate-api=ghcr.io/<owner>/notomate-api:main
        - notomate/notomate-collab=ghcr.io/<owner>/notomate-collab:main
        - notomate/notomate-messaging=ghcr.io/<owner>/notomate-messaging:main
        - notomate/notomate-nginx=ghcr.io/<owner>/notomate-nginx:main
  destination:
    server: https://kubernetes.default.svc
    namespace: notomate-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
---
apiVersion: argocd-image-updater.argoproj.io/v1alpha1
kind: ImageUpdater
metadata:
  name: notomate-staging
  namespace: argocd
spec:
  writeBackConfig:
    method: argocd
  applicationRefs:
    - namePattern: notomate-staging
      images:
        - alias: api
          imageName: ghcr.io/<owner>/notomate-api
          commonUpdateSettings: &settings
            updateStrategy: newest-build
            allowTags: "regexp:^[0-9a-f]{7}$"
          manifestTargets:
            kustomize:
              name: notomate/notomate-api
        - alias: collab
          imageName: ghcr.io/<owner>/notomate-collab
          commonUpdateSettings: *settings
          manifestTargets:
            kustomize:
              name: notomate/notomate-collab
        - alias: messaging
          imageName: ghcr.io/<owner>/notomate-messaging
          commonUpdateSettings: *settings
          manifestTargets:
            kustomize:
              name: notomate/notomate-messaging
        - alias: nginx
          imageName: ghcr.io/<owner>/notomate-nginx
          commonUpdateSettings: *settings
          manifestTargets:
            kustomize:
              name: notomate/notomate-nginx
```

For private packages add `pullSecret: pullsecret:argocd/<secret>` to the
`commonUpdateSettings`.

## Notes

- The API defaults to SQLite + local uploads on the `notomate-api-data` PVC,
  hence a single replica with `Recreate`. Switching to Postgres/S3 (see
  `docker/docker-compose.postgres.yml`, `docker/docker-compose.minio.yml`)
  is what it would take to scale it out.
- Images are built for `linux/amd64` only (the Go build in `Dockerfile`
  hardcodes `GOARCH=amd64`).
- Render locally: `kubectl kustomize deploy/k8s/base`
