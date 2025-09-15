# Use official Node.js 22 image from GitHub Container Registry
FROM ghcr.io/nodejs/node:22-bullseye

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production)
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose your app port (change if needed)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
