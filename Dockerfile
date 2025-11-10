# Build stage
# Updated CSP configuration for Railway deployment - 2024-11-10
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and npm config
COPY package*.json ./
COPY .npmrc ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Pass environment variables to build
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ARG REACT_APP_ADMIN_FEE_PERCENTAGE
ARG REACT_APP_APP_NAME
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ARG REACT_APP_WASABI_ACCESS_KEY_ID
ARG REACT_APP_WASABI_SECRET_ACCESS_KEY
ARG REACT_APP_WASABI_BUCKET_NAME
ARG REACT_APP_WASABI_REGION
ARG REACT_APP_MAILGUN_API_KEY
ARG REACT_APP_MAILGUN_DOMAIN

ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL
ENV REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY
ENV REACT_APP_ADMIN_FEE_PERCENTAGE=$REACT_APP_ADMIN_FEE_PERCENTAGE
ENV REACT_APP_APP_NAME=$REACT_APP_APP_NAME
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_WASABI_ACCESS_KEY_ID=$REACT_APP_WASABI_ACCESS_KEY_ID
ENV REACT_APP_WASABI_SECRET_ACCESS_KEY=$REACT_APP_WASABI_SECRET_ACCESS_KEY
ENV REACT_APP_WASABI_BUCKET_NAME=$REACT_APP_WASABI_BUCKET_NAME
ENV REACT_APP_WASABI_REGION=$REACT_APP_WASABI_REGION
ENV REACT_APP_MAILGUN_API_KEY=$REACT_APP_MAILGUN_API_KEY
ENV REACT_APP_MAILGUN_DOMAIN=$REACT_APP_MAILGUN_DOMAIN

# Build the app
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files and npm config for production dependencies
COPY package*.json ./
COPY .npmrc ./

# Install production dependencies (including express and prerender-node)
RUN npm ci --only=production

# Copy built app from build stage
COPY --from=build /app/build ./build

# Copy server.js
COPY server.js ./

# Expose port
EXPOSE $PORT

# Start the Express server with Prerender middleware
CMD ["node", "server.js"]
