<div align="center">

<img src="web/src/assets/app.svg" width="88" alt="CollabReef" />

# CollabReef

A simple, self-hosted, all-in-one note-taking app.

**English** · [繁體中文](./README.zh-TW.md)

</div>

Write anything, anywhere — memos, journals, work notes, checklists, or a blog. The block-based editor supports rich text, media, embeds, and more, so you can capture complete notes in one place. Fully self-hosted, so your data stays yours.

## Installation

### Docker Compose (recommended)

```yaml
services:
  api:
    image: ti777777/collabreef
    container_name: collabreef-api
    command: ["./api"]
    volumes:
      - collabreef_data:/usr/local/app/bin
    environment:
      PORT: 8080
      DB_DRIVER: sqlite3
      DB_DSN: /usr/local/app/bin/collabreef.db
      # APP_SECRET: your-secret-key
      # APP_DISABLE_SIGNUP: true
    restart: unless-stopped

  collab:
    image: ti777777/collabreef
    container_name: collabreef-collab
    command: ["node", "collab/src/index.js"]
    environment:
      PORT: 3000
      GRPC_ADDR: collabreef-api:50051
      # APP_SECRET: your-secret-key
    depends_on:
      - api
    restart: unless-stopped

  nginx:
    image: ti777777/collabreef-nginx
    container_name: collabreef-nginx
    ports:
      - "80:80"
    depends_on:
      - api
      - collab
    restart: unless-stopped

volumes:
  collabreef_data:
    driver: local
```

```bash
docker compose up -d
```

The app will be available at `http://localhost`. See [`.env.example`](./.env.example) for configuration options.

## Workflows (beta)

CollabReef ships a Gitea-Actions-style automation system. Workflows are defined per workspace (Workflows page in the sidebar) with GitHub-Actions-compatible YAML and executed by a separate runner service that runs each job in a Docker container via [act](https://github.com/nektos/act).

Supported triggers:

- `note` — fires on `created` / `updated` / `deleted` note events in the workspace (updates are debounced)
- `schedule` — standard 5-field cron expressions
- `workflow_dispatch` — manual runs with optional inputs

```yaml
name: Notify on note changes
on:
  note:
    types: [created, updated]
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:
    inputs:
      message:
        default: "hello"
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "event=$CB_EVENT_NAME workspace=$CB_WORKSPACE_ID note=$CB_NOTE_ID"
          cat "$GITHUB_EVENT_PATH"   # full event payload JSON
```

Jobs see the event payload at `$GITHUB_EVENT_PATH` plus `CB_EVENT_NAME`, `CB_WORKSPACE_ID`, `CB_NOTE_ID`, `CB_RUN_ID` and `CB_RUN_NUMBER`.

### Running a runner

The runner is opt-in. Set a shared `RUNNER_REGISTRATION_TOKEN` for the api and runner services (see `.env.example`) and add the runner container — it needs the Docker socket:

```yaml
  runner:
    image: ti777777/collabreef-runner
    container_name: collabreef-runner
    environment:
      CB_INSTANCE_ADDR: collabreef-api:50051
      CB_RUNNER_REGISTRATION_TOKEN: your-registration-token
      CB_RUNNER_LABELS: ubuntu-latest:docker://node:20-bullseye
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - collabreef_runner_data:/data
    depends_on:
      - api
    restart: unless-stopped
```

Instance admins can see registered runners and the registration token in workspace settings.

**Security notes**

- Workflows execute arbitrary commands on the runner host's Docker daemon. Only workspace owners/admins can create or edit workflows, and the runner host is part of your trust boundary.
- Don't paste secrets into workflow YAML — definitions are readable by all workspace members. If a job needs to call the CollabReef API, use an API key and be aware that a workflow that modifies notes can retrigger itself (a per-workflow rate limit of 30 runs/minute is the backstop).
- Keep the gRPC port (50051) on the internal network; the runner protocol has token auth but no TLS.

## Contributing

Contributions are welcome! Fork the repo, create a feature branch, and open a pull request.

## License

CollabReef is licensed under the **MIT License**.
