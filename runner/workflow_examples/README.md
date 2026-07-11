# Workflow Examples

A handful of examples you can copy-paste straight into a workspace's
"Workflows" page, demonstrating the most common pattern: periodically
fetching external data and writing the result into a note via the
Notomate HTTP API.

(Traditional Chinese: [README.zh-TW.md](./README.zh-TW.md))

| File | Trigger | Description |
| --- | --- | --- |
| [`scheduled-note.yml`](./scheduled-note.yml) | `schedule` / `workflow_dispatch` | Minimal template: no external data, just creates a new note in the same workspace on a schedule (e.g. a daily log), deduping by title so a manual re-run doesn't create a duplicate. |
| [`manual-note-from-input.yml`](./manual-note-from-input.yml) | `workflow_dispatch` | No schedule - run it by hand and fill in `title`/`content` inputs to create a note with exactly that content; demonstrates reading `workflow_dispatch` inputs via `github.event.inputs`. |
| [`rss-to-notes.yml`](./rss-to-notes.yml) | `schedule` / `workflow_dispatch` | Subscribes to an RSS feed and creates a note per new item, deduping with full-text content search. |
| [`hacker-news-digest.yml`](./hacker-news-digest.yml) | `schedule` / `workflow_dispatch` | Rolls up top Hacker News stories into a single daily digest note; demonstrates a plain JSON API (no key needed). |
| [`github-releases-watch.yml`](./github-releases-watch.yml) | `schedule` / `workflow_dispatch` | Watches a repo's latest GitHub release and creates a notification note when a new one is published. |

## How to use

1. Open any `.yml` file and copy its full contents into the workspace's
   "Workflows" page to create a new workflow.
2. Go to "User Settings > API Keys" and create an API key (the user it
   belongs to must be a member of the target workspace).
3. Go to the workspace's "Workflows" settings page and add the **vars**
   (plain parameters, e.g. a feed URL) and **secrets** (sensitive values,
   e.g. the API key from step 2) noted in the comment at the top of each
   example file. Every example needs:
   - `secrets.NM_API_KEY` — the API key used to call the Notomate API
   - `vars.NM_API_BASE_URL` — an address the runner container can reach for
     the api service. If api and runner are in the same docker compose
     project, this is usually `http://notomate-api:8080` (matching
     `container_name: notomate-api`, `PORT: 8080` in the compose example
     in the root [`README.md`](../../README.md)).
4. Save and run it once (`workflow_dispatch`) to confirm it works, then let
   the schedule take over.

## Notes

- Every example writes a small script to a temp file with Node.js (the
  runner's default `ubuntu-latest` label maps to the `node:20-bullseye`
  image) and runs it, avoiding the need to handle complex JSON escaping
  inline in YAML.
- Workflow definitions (the `on`/`jobs` content) are visible to every
  workspace member, so "not secret but changes often" parameters like feed
  URLs or repo names belong in **vars**, while API keys, tokens, etc.
  always belong in **secrets**, injected via `${{ vars.X }}` /
  `${{ secrets.X }}` - never hardcoded in a `run:` script.
- Workflows that create or modify notes should be mindful of self-trigger
  risk — each workflow has a safety cap of 30 runs per minute; see the
  "Workflows" section in the main README for details.
- The RSS example ships a simplified regex-based `<item>` parser, good
  enough for most RSS 2.0 feeds but not a full XML/Atom parser; adjust the
  `sync.js` portion yourself if your source feed has an unusual format.
