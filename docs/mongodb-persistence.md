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
  - The JSON DB object (excluding `landings`) is stored in Mongo in the `app_state` collection under document `_id: "db"`.
  - Landings are stored in a dedicated `landings` collection (one document per landing).
  - Version metadata is stored in a dedicated `versions` collection (one document per version).
  - Audit logs are stored in Mongo in the `audit` collection:
    - One document per landing: `_id: <landingId>`
    - `entries: [...]` (newest first)
  - Version content continues to live on the filesystem under `data/versions`.
  - Sessions are stored in Mongo (collection `sessions`) when `PERSISTENCE_ENGINE=mongo`.

## Bootstrap sync behavior

When `PERSISTENCE_ENGINE=mongo` and `MONGO_SYNC_ON_BOOT=true`:

- The app reads `data/db.json`.
- It upserts Mongo document `app_state/_id=db` with `{ data: <jsonDb without landings>, syncedAt: ... }`.
- It syncs `data/db.json` landings into the `landings` collection.
- It syncs existing on-disk version `metadata.json` files into the `versions` collection.
- If `MONGO_SYNC_FORCE=false` and data already exists, sync is skipped for each component.

## Sessions

- In Mongo mode, sessions are stored in the `sessions` collection.
- TTL is controlled by `SESSION_TTL_SECONDS`.

## Notes

- Landing assets remain on disk under `data/landings` in both modes.
- In `json` mode, sessions remain file-based under `data/sessions`.
