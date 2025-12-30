# MongoDB persistence

## Goal

Superlandings supports two persistence engines:

- `json` (default): persists application state in `data/db.json`.
- `mongo`: persists application state in MongoDB while keeping the JSON file for retro-compatibility.

When Mongo persistence is enabled, the app performs an idempotent sync from the JSON DB into Mongo at bootstrap.

## Environment variables

- `PERSISTENCE_ENGINE`
  - `json` (default)
  - `mongo`

- `MONGO_URI`
  - Mongo connection string.
  - It may include the database name, for example:
    - `mongodb://localhost:27017/superlandings`

- `MONGO_DB`
  - Optional.
  - Required only when `MONGO_URI` does **not** include a database name.

- `MONGO_SYNC_ON_BOOT`
  - Optional.
  - Defaults to `true`.
  - When `true` and `PERSISTENCE_ENGINE=mongo`, the app will sync JSON → Mongo at startup.

- `MONGO_SYNC_FORCE`
  - Optional.
  - Defaults to `false`.
  - When `true`, forces JSON → Mongo sync even if Mongo already has data.

## Data layout

- JSON mode:
  - `data/db.json` is the source of truth.
  - Versions and audit logs are stored on the filesystem under `data/versions` and `data/audit`.

- Mongo mode:
  - The full JSON DB object is stored in Mongo in the `app_state` collection under document `_id: "db"`.
  - Audit logs are stored in Mongo in the `audit` collection:
    - One document per landing: `_id: <landingId>`
    - `entries: [...]` (newest first)
  - Version content continues to live on the filesystem under `data/versions`.

## Bootstrap sync behavior

When `PERSISTENCE_ENGINE=mongo` and `MONGO_SYNC_ON_BOOT=true`:

- The app reads `data/db.json`.
- It upserts Mongo document `app_state/_id=db` with `{ data: <jsonDb>, syncedAt: ... }`.
- If `MONGO_SYNC_FORCE=false` and `app_state/_id=db` already exists, sync is skipped.

## Notes

- Landing assets remain on disk under `data/landings` in both modes.
- Sessions remain file-based under `data/sessions`.
