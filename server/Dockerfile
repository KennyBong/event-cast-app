# Use the official Node.js 18 image.
# https://hub.docker.com/_/node
FROM node:18-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
COPY package*.json ./

# Install production dependencies.
RUN npm install --only=production

# Copy local code to the container image.
COPY . .

# Service must listen to $PORT environment variable.
# Cloud Run sets this to 8080 by default.
ENV PORT 8080

# Run the web service on container startup.
CMD [ "npm", "start" ]
