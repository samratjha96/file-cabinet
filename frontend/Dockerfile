# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install gettext-base for envsubst
RUN apk add --no-cache gettext

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Set default backend port
ENV BACKEND_PORT=3001

# Expose port
EXPOSE 80

# Start nginx (nginx will automatically process templates in /etc/nginx/templates/)
CMD ["nginx", "-g", "daemon off;"] 
