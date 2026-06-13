# Use official Node.js 20 lightweight Debian-slim image
FROM node:20-slim

# Install dependencies needed for Prisma and SSL connections
RUN apt-get update -y && apt-get install -y openssl ca-certificates



# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install clean production dependencies
RUN npm ci

# Copy all source files
COPY . .

# Generate the Prisma Client using the PostgreSQL schema
RUN npx prisma generate

# Build the TypeScript project into JavaScript
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Set production environment variable
ENV NODE_ENV=production

# Run migrations/push schema on startup, then start the server
CMD npx prisma db push && npm start
