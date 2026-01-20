FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies for backend build
WORKDIR /app/backend
RUN npm ci

# Copy source code and shared modules
WORKDIR /app
COPY backend ./backend
COPY shared ./shared

# Build TypeScript
WORKDIR /app/backend
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port (Cloud Run will override this)
EXPOSE 8080

# Start the server
CMD ["node", "dist/backend/src/index.js"]
