FROM node:20-bullseye

WORKDIR /app

# Install build tools for canvas and sqlite (if needed)
RUN apt-get update && apt-get install -y python3 g++ make

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
