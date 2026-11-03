# 66 - Cloud Run execution

Owner decision, 2026-10-28: reduce GCP idle costs by running the web backend with
request-based billing and zero minimum instances; execute TMDB catalog syncs as
on-demand Cloud Run Jobs. Free-tier allowances are billing-account-wide, not a
guarantee of zero charges.

## Contract

- Existing deployments retain inline execution by default. An explicit external
  execution configuration makes the web service passive: no scheduler, background
  catalog/playlist runs, or live encoder startup. Re-arming callbacks cannot enable
  its scheduler. Manual run/sync endpoints refuse with a stable error and useful
  explanation rather than accepting work that can be frozen after the response.
- Job views expose an optional execution-disabled reason. The admin's run controls
  use that reason as their disabled tooltip. Catalog workers are operated and
  monitored in Cloud Run Jobs; web-process in-memory progress does not represent
  a remote execution. Persisted last-result/count fields still show completed runs.
- External-mode progress SSE sends one empty snapshot and closes immediately, so
  an open admin tab cannot keep a billable request alive. Automatic stale-channel
  reloads do not reopen SSE; explicit Refresh, focus and token changes still can.
- A headless backend entrypoint executes one configured existing catalog job ID,
  using the existing job runner and Turso store. It does not listen on a port,
  bootstrap accounts, start live encoders, or arm the scheduler. It awaits the
  actual run's settlement, logs phase progress without credentials, and exits
  successfully only for an `ok` result. Invalid/non-catalog IDs fail before work.
- SIGTERM/SIGINT request cancellation, wait for settlement, and close resources.
  Already committed rows remain. Discovery has no persistent page cursor and can
  reread pages after restart; do not advertise exact resume. Recent-update cursors
  retain the existing success-only advancement semantics.
- Worker service configuration uses one task, parallelism one, no automatic
  retries, and a bounded timeout. Operators must check both catalog jobs for active
  executions before launching a fill: Cloud Run permits overlapping executions and
  these runners' single-flight guards are process-local.
- This deployment is on-demand. Database schedule labels are not Cloud Scheduler
  jobs and will not fire automatically in the passive web process.

## Verification

Tests must prove external mode cannot start/re-arm work, the one-shot worker waits
for real completion and exits on failure/cancellation, and the admin respects the
disabled reason. Existing inline execution remains compatible. Verify a real
Cloud Run Job progresses against production after stopping the old inline run,
and verify the service has minimum zero with request-based CPU allocation.

## Deployment facts before transition

- Project: `gen-lang-client-0250251927`, region: `us-east1`.
- Web service: `giga-stream-backend`; production data lives in remote Turso.
- Existing catalog jobs: Library fill ID 6; Library update ID 7.
- Secret Manager names use the `giga-stream-` prefix. Never put their values in
  source, container images, command output, or documentation.
- Source images build from the repository-root Dockerfile. Upload filtering must
  exclude local data and secrets while retaining the admin's playlist components.

## Verified deployment (2026-10-28 local / 2026-10-29 UTC)

- API revision `giga-stream-backend-00003-ln5`: 100 percent traffic, no tagged old
  revision, zero minimum instances, maximum one, request-based CPU, 512 MiB memory,
  `SYNC_EXECUTION_MODE=external`. The former central-region diagnostic service was
  deleted. The unused `giga-stream-prod-20261028` project has no billing link.
- Image digest:
  `sha256:3027bffa8a43f9e4288a5c335e9bf03207c1ae3435a053504cd88154bf40764f`.
- Cloud Run Job: `giga-stream-catalog-sync`, default `SYNC_JOB_ID=6`; command
  `node src/backend/dist/catalog-worker.js`; one task, parallelism one, zero retries,
  1 vCPU, 1 GiB, 24-hour timeout. Only Turso URL/token and TMDB token are injected.
- Inline run stopped cleanly with 22,540 processed title entries retained. Execution
  `giga-stream-catalog-sync-7z9fc` then completed the fill successfully in 5h 6m.
- Gate passed: 2,921 tests plus typechecks, lint, and rules. Local-stack smoke was
  skipped because no stack was running. Production API returned the external reason,
  refused manual inline execution with 422, and closed its SSE response with 200.
- Full browser visual verification was unavailable because the Chrome extension
  connection timed out. Disabled-control markup and wire decoding are covered by tests.

## Operating commands (PowerShell)

Use a new terminal after SDK installation. First check for running executions;
do not overlap the fill and update against this shared database.

```powershell
gcloud run jobs executions list --job=giga-stream-catalog-sync --region=us-east1 --project=gen-lang-client-0250251927
gcloud run jobs executions list --job=giga-stream-catalog-update --region=us-east1 --project=gen-lang-client-0250251927

# Full Library fill, only when no catalog execution is active:
gcloud run jobs execute giga-stream-catalog-sync --region=us-east1 --project=gen-lang-client-0250251927 --async

# Incremental Library update (the scheduler normally starts this):
gcloud run jobs execute giga-stream-catalog-update --region=us-east1 --project=gen-lang-client-0250251927 --async

# Cancel a specific execution; retained rows are not rolled back:
gcloud run jobs executions cancel EXECUTION_NAME --region=us-east1 --project=gen-lang-client-0250251927
```

The admin page is `https://giga-stream-backend-lz23tv4noq-ue.a.run.app/admin/`.
Use Cloud Run Jobs for active progress and cancellation. Admin last-result fields
update when the worker finishes; its in-memory running indicator is not remote status.
At the 2026-10-29 verification point no Cloud Scheduler trigger existed; database
schedule fields still do not run in external mode. The follow-up below adds the trigger.

## Follow-up (2026-11-03): the short URL and a trigger

- Owner decision: `gigastream.app/admin/` is the admin console again. The fileserver forwards `/admin`,
  `/api/admin`, `/live` and `/logos` at their own paths to the loopback backend when `ADMIN_PROXY_TARGET`
  is set (`docs/64` section 1 as amended); the packaged desktop never sets it. The Cloud Run service keeps
  its own URL for the same console; both deployments share the one Turso.
- The Render pair is always on, so its loopback backend stays inline (live encoder available); its
  `TMDB_SYNC_SCHEDULE` stays off, so catalog work still belongs to Cloud Run Jobs.
- Cloud Scheduler is now enabled on the project with one HTTP job,
  `giga-stream-catalog-update`: every 6 hours (UTC) it calls the separate Cloud Run Job of the same name
  through the v2 `:run` API using OAuth. That job fixes `SYNC_JOB_ID=7`, one task, parallelism one, zero
  retries and a 4-hour timeout; the 24-hour fill job remains manual.
- Cloud Run permits overlapping executions. Validation proved it by starting two update executions; the
  duplicate was cancelled immediately. The update timeout is shorter than its schedule interval and the
  Scheduler target has no retries, preventing scheduled overlap; operators must still check both jobs
  before any manual fill or update.

## Cost model

At current us-east1 on-demand rates, the job's CPU plus memory costs about $0.072
per execution hour before free allowance. A single 24-hour task is about $1.73 in
compute, excluding networking/storage and incidental startup time. This timeout
is a per-execution bound, not an account spending cap. Cloud Run instance/job CPU
free allowance is 240,000 vCPU-seconds per month (about 66.7 one-vCPU hours), shared
across the billing account. The API is billed for active requests/startup, not an
always-on reservation. Build, artifact storage, secrets, and network quotas are
separate. Do not promise that the whole deployment is necessarily free.
