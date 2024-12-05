ARG PLATFORM=linux/amd64
FROM --platform=$PLATFORM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/test-event-hub.js"]
