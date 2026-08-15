FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Install vendored ref-saasbackend dependencies if the directory is present.
# This keeps the Docker image self-contained even when the vendored backend
# is used instead of the npm package.
RUN if [ -f ref-saasbackend/package.json ]; then cd ref-saasbackend && npm install --ignore-scripts; fi

# Create data directory
RUN mkdir -p /app/data/landings /app/data/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]