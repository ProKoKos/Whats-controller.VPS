FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm install

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy public static files
COPY --from=builder /app/src/public ./dist/public

# Create logs directory
RUN mkdir -p logs

# Expose ports
EXPOSE 3000 3001

# Start application
CMD ["node", "dist/index.js"]

