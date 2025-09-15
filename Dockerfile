# Use specific Node.js 22 LTS image with Debian base to avoid registry metadata issues
FROM node:22-bullseye

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose app port (change if needed)
EXPOSE 3000

# Default command
CMD ["node", "server.js"]
