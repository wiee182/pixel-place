# Use Node.js 20 on Debian Bullseye
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Install build tools needed for better-sqlite3
RUN apt-get update && apt-get install -y python3 g++ make

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all project files
COPY . .

# Expose port
EXPOSE 3000

# Persist SQLite database
VOLUME ["/app/canvas.db"]

# Start the server
CMD ["node", "server.js"]
