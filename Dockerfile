FROM node:18-alpine

WORKDIR /app

# Copy the whole build context first so a vendored ref-saasbackend (if present)
# is available before we install dependencies.
COPY . .

# When the vendored backend is present, install its dependencies so its
# packages (mongoose, ssh2-sftp-client, etc.) are available at runtime.
# --ignore-scripts avoids native module build issues that are not needed here.
RUN if [ -f /app/ref-saasbackend/package.json ]; then \
      (cd /app/ref-saasbackend && npm install --ignore-scripts); \
    fi

# Install the main application dependencies
RUN npm install --production --ignore-scripts

# Create data directory
RUN mkdir -p /app/data/landings /app/data/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]