# Base Node.js image
FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the project
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
