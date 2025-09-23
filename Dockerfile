# Use official Node.js LTS image
FROM node:22-slim

# Set working directory
WORKDIR /usr/src/app

# Install only production dependencies first (for faster caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the project
COPY . .

# Expose port
EXPOSE 3000

# Use environment variable for Node environment
ENV NODE_ENV=production

# Start server
CMD ["node", "server.js"]
