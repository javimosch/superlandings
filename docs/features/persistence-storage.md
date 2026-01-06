# Persistence & Storage Engines

SuperLandings supports a flexible persistence layer that allows switching between lightweight JSON storage for development and MongoDB for production-grade environments.

## What it is
The persistence engine (`lib/store.js`) abstracts the database operations, allowing the application to work with a unified interface regardless of the underlying storage.

## Configuration
The storage engine is controlled by the `PERSISTENCE_ENGINE` environment variable:

- `PERSISTENCE_ENGINE`
  - Options: `json` (default), `mongo`
  - Determines which storage logic to use at runtime.

### JSON Engine
- **Storage**: A single `data/db.json` file.
- **Suitability**: Small deployments, local development, and simple backups.
- **Workflow**: The entire database is read into memory on every request and written back atomically on updates.

### MongoDB Engine
- **Storage**: External MongoDB database.
- **Suitability**: Scalable deployments, multi-instance setups, and high-concurrency environments.
- **Required Env Vars**:
  - `MONGO_URI`: Connection string (e.g., `mongodb://user:pass@host:27017/dbname`).
  - `MONGO_DB`: Database name (if not included in URI).
  - `MONGO_SYNC_ON_BOOT`: (boolean, default `true`) Syncs local `db.json` to Mongo on startup.

## Data Synchronization
When switching from JSON to MongoDB, the system can automatically migrate your data:

1.  **Bootstrap Sync**: On the first run with `PERSISTENCE_ENGINE=mongo`, the system reads the local `db.json` and syncs all landings, organizations, and versions to MongoDB.
2.  **File Synchronization**: For `html` and `virtual` landing types, the system reads the physical files from the disk and stores their content directly in MongoDB to ensure consistency across multiple application instances.
3.  **App State**: Global configuration and organization data are stored in a special `app_state` collection.

## File System Persistence
Regardless of the database engine, certain assets are always stored on the filesystem for performance:
- **ZIP Snapshots**: Versions of EJS and Virtual landings are stored as ZIPs in `data/versions/`.
- **Active Landings**: The currently active files for a landing are cached in `data/landings/` for fast serving by the middleware.
- **Uploads**: Temporary file uploads are stored in `data/uploads/`.

## API (Internal)
The `lib/store.js` provides several key methods used by the routes:
- `readDB()`: Returns the full database state (Landings + App State).
- `writeDB(data)`: Persists the state to the configured engine.
- `initPersistence()`: Handles the bootstrap sync and connection logic.

## Best practices
- **Backups**: If using the JSON engine, regularly backup the `data/db.json` file.
- **Mongo Security**: Always use a dedicated database user with limited permissions and enable TLS if connecting over a public network.
- **Syncing**: Use `MONGO_SYNC_FORCE=true` if you need to manually re-sync your local JSON data to an existing MongoDB database.
