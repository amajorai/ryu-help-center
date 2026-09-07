<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./icon-dark.png" />
    <img src="./icon-light.png" alt="Help Center" width="144" />
  </picture>
</p>

<div align="center">

# Help Center

</div>

A Space-backed support workspace for tickets, knowledge, and human-reviewed AI assistance.

> **The public home of `ryu-help-center`.** Source, builds, and releases live here —
> binaries for every platform are attached to each release.
>
> This tree is generated from the Ryu monorepo, so commits pushed here
> directly are replaced on the next sync. **Pull requests are welcome** —
> open them here and they are ported into the monorepo, then flow back out.
> Ryu as a whole: https://github.com/amajorai/ryu

## Install

**App:** [Install](ryu://apps/@ryu/help-center) (opens the Ryu desktop app and asks you to confirm)

**CLI:**

```bash
ryu apps add @ryu/help-center
```

## Source & build

This is the **source of record** for the app UI. It imports Ryu's private
`@ryu/ui` design system, so it does **not** build standalone outside the
monorepo — it **builds inside the amajorai/ryu monorepo workspace**.
The **shipped bundle below is the built artifact**: a prebuilt single-file
companion bundle is included at [`dist/help-center.ui.html`](./dist/help-center.ui.html) —
the runnable UI Ryu loads for this app.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Parts

- **Companion:** a full-page desktop companion with local views for Overview,
  Inbox, Tickets, Knowledge, Agent, and Insights.
- **Ticket inbox:** ticket search, assignment, priority, snooze, resolution,
  reopening, and local reply or internal-note history.
- **Knowledge:** article editing, draft and published states, semantic search,
  usage counts, and unanswered-question review.
- **Agent:** a bounded customer-question preview that uses selected Help Center
  knowledge and offers human handoff when the answer is uncertain.
- **Insights:** deterministic local metrics for queue health, handoffs,
  unanswered questions, resolution time, topics, and article usage.

## Data ownership

Help Center stores tickets and knowledge articles as documents in a dedicated
Ryu Space. Ryu Core and Spaces own Space identity, tenancy, access control,
indexing, retrieval, and document persistence. Help Center owns the ticket and
article source schema, projections, filters, prompts, and local UI state.

Namespaced `storage:kv` data stores the Help Center Space id and local
preferences. It does not store ticket or article bodies. Help Center has no
dedicated sidecar, remote support backend, direct network request, or
app-specific Core route.

## Bridge capabilities

The companion uses the typed Ryu host bridge with these declared capabilities:

- `spaces:docs` to create, read, update, delete, list, and search Help Center
  documents.
- `storage:kv` to remember the Space id and local preferences.
- `hook:side-model` to request bounded model completions through Ryu's model
  bridge.

## Desktop support and activation

The complete Help Center experience runs in Ryu's desktop companion host. Hosts
that do not expose the Space activation and search bridge are not claimed as
supported surfaces for this release.

When the Help Center Space is empty, Help Center shows an activation state. A
user must choose **Load sample workspace** or **Create first ticket**. Sample
records are deterministic and are never loaded automatically. If the host
bridge is unavailable, Help Center keeps sample state in memory and shows a
visible **Demo mode** marker.

## AI and human approval

Ryu can classify tickets, summarize conversations, suggest replies and related
articles, draft a knowledge article, and answer a customer question in the
Agent preview. A request includes only the selected ticket, agent settings, and
bounded relevant Help Center search matches.

AI output is a suggestion. A human reviews and edits a reply before Help Center
adds it to the local conversation, and a human explicitly reviews and publishes
an article. Adding a reply records local history and does not send an external
message. A denied or failed model call remains an error and does not fall back
to demo output.

## Build and test

```sh
bun run --cwd apps-store/help-center/ui test
bun run --cwd apps-store/help-center/ui check-types
bun run --cwd apps-store/help-center/ui build
```

The build emits one self-contained `dist/index.html` with no runtime network
dependency.

## Current boundary

This release does not ingest or deliver email, WhatsApp, SMS, voice, Slack, or
social messages. It does not provide public webhook ingestion, an externally
hosted customer widget or help-center domain, autonomous outbound replies,
irreversible customer actions, billing, seats, SLA enforcement, or cloud
administration. Those require separate delivery, authentication, and
operational systems.
