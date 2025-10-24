FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p /app/data/landings /app/data/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]