FROM node:14.16.1-alpine3.13

WORKDIR /app

# Copy package.json into app folder
COPY package.json .

# Install dependencies
RUN npm install
COPY . .

# Start script on Xvfb
CMD node index.js