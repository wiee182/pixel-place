# Use stable Node.js 20 LTS image from Docker Hub
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose your app port (change if needed)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
