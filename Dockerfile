# Use stable Node.js 20 LTS
FROM node:20-bullseye

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install all deps (not just production, since you need better-sqlite3)
RUN npm install

# Copy the rest of the app
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
