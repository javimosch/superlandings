# SuperLandings

A Node.js server for managing and serving multiple landing pages with different formats.

## Features

- 🚀 **Multiple Landing Types**
  - Single HTML files
  - Static folders (compiled frontends)
  - EJS templates

- 🔐 **Admin Panel**
  - Basic authentication
  - Upload ZIP files or multiple files
  - HTML editor with CodeMirror
  - Manage all landings from one interface

- 🛠️ **CLI Tool**
  - Quickly add single HTML landings
  - Simple command-line interface

- 🐳 **Docker Ready**
  - Complete Docker setup
  - Docker Compose configuration
  - Persistent data storage

## Installation

### Local Development

```bash
# Install dependencies
npm install

# Create .env file (already created with default values)
# Or customize it with your own credentials:
# echo 'ADMIN_USERNAME=yourusername
ADMIN_PASSWORD=yourpassword
PORT=3000' > .env

# Start the server
npm start

# Or use nodemon for development
npm run dev
```

### Docker

```bash
# Using Docker Compose
docker compose up -d

# Or build manually
docker build -t superlandings .
docker run -p 3000:3000 -v landing-data:/app/data superlandings
```

## Usage

### Access the Admin Panel

1. Navigate to `http://localhost:3000/admin`
2. Login with credentials from `.env` (default: admin/admin)

### CLI - Add Landing

```bash
# Add a single HTML landing
npm run cli <slug> <html-file> [name]

# Example
npm run cli crevisto ./crevisto.html "Crevisto Landing"
```

### View Your Landing

Access your landing at: `http://localhost:3000/<slug>`

Example: `http://localhost:3000/crevisto`

## Landing Types

### Single HTML File
- Perfect for simple landing pages
- Edit directly in the admin panel with CodeMirror
- Upload a single HTML file

### Static Folder
- Upload a ZIP file containing your static site
- Or upload multiple files (HTML, CSS, JS, images)
- Great for compiled frontends (React, Vue, etc.)

### EJS Template
- Upload EJS template files
- Dynamic server-side rendering
- Access to Express/EJS features

## Configuration

### Environment Variables

Create a `.env` file:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
PORT=3000

# Traefik Gateway Configuration (Optional)
TRAEFIK_ENABLED=false
TRAEFIK_REMOTE_HOST=your-traefik-server.com
TRAEFIK_REMOTE_USER=root
TRAEFIK_REMOTE_PORT=22
TRAEFIK_REMOTE_PATH=/data/coolify/proxy/dynamic
SERVER_IP=http://superlandings:3000
```

### Traefik Integration

SuperLandings can automatically deploy Traefik configurations for each landing, enabling custom domains:

1. **Enable Traefik**: Set `TRAEFIK_ENABLED=true` in `.env`
2. **Configure Connection**: Set your Traefik server details (host, user, SSH port, path)
3. **Set Server IP**: The URL where your SuperLandings server is accessible to Traefik
4. **SSH Key**: Ensure SSH key authentication is set up for the remote Traefik server

#### How It Works

1. In the admin panel, configure a domain for each landing
2. Click "Publish" to deploy a Traefik configuration file to the remote server
3. Traefik automatically routes the domain to your landing
4. Click "Unpublish" to remove the Traefik configuration

All operations are logged to help troubleshoot deployment issues.

For detailed Traefik setup instructions, see [TRAEFIK_SETUP.md](./TRAEFIK_SETUP.md).

### Data Structure

All data is stored in the `./data` directory:

```
data/
├── landings/
│   ├── crevisto/
│   │   └── index.html
│   ├── my-app/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   └── ejs-landing/
│       └── index.ejs
├── uploads/
└── db.json
```

### Docker Volume

When using Docker, data persists in a named volume: `landing-data`

## API Endpoints

### Admin Routes (Basic Auth Required)

- `GET /admin` - Admin panel interface
- `GET /api/landings` - List all landings
- `POST /api/landings` - Create new landing
- `GET /api/landings/:id/content` - Get HTML content
- `PUT /api/landings/:id` - Update HTML content
- `PUT /api/landings/:id/domain` - Update landing domain
- `POST /api/landings/:id/publish` - Publish landing to Traefik
- `POST /api/landings/:id/unpublish` - Unpublish landing from Traefik
- `DELETE /api/landings/:id` - Delete landing (auto-unpublishes if needed)

### Public Routes

- `GET /` - Home page
- `GET /:slug` - View landing page

## Examples

### Test the Setup

1. Start the server:
   ```bash
   npm start
   ```

2. Add the test landing:
   ```bash
   npm run cli crevisto ./crevisto.html "Crevisto Test"
   ```

3. Visit: `http://localhost:3000/crevisto`

4. Access admin: `http://localhost:3000/admin`

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev
```

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vue 3, Tailwind CSS (CDN)
- **Editor**: CodeMirror
- **File Upload**: Multer
- **ZIP Handling**: adm-zip
- **Template Engine**: EJS
- **Authentication**: express-basic-auth

## License

MIT