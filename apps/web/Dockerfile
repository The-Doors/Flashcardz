# Build stage
FROM node:22-alpine AS build

# Set working directory to the repo root inside the container
WORKDIR /app

# Copy root package files if present
COPY package*.json ./

# Copy web app package files into apps/web/
COPY apps/web/package*.json ./apps/web/

# Install dependencies inside apps/web
WORKDIR /app/apps/web
RUN npm install

# Copy all source files relative to repo root
WORKDIR /app
COPY apps/web/ ./apps/web/

# Build the web app
WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built dist files to Nginx web root
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]