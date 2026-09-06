## Stack

- NodeJS
- EJS
- TailwindCDN
- FS (for file storage)

## Coding guidelines:

- You can refactor into modular (to reduce LOC per file)
- Prefered modus operandi => refactor first, create new files for new features, make minimal changes to existing files

## Verification:

- Run tests with: `node --test tests/*.test.js`
- There is no `npm test` script; tests use Node's built-in test runner
