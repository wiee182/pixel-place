# Use Node.js
FROM node:22

# Set app directory
WORKDIR /app

# Copy files
COPY package*.json ./
RUN npm install
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
