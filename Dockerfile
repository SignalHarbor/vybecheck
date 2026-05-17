FROM node:20-slim AS build

WORKDIR /app

# Build-time env vars for Vite (baked into the frontend bundle)
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Copy test audio files for AI generation
COPY test-audio ./test-audio

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
