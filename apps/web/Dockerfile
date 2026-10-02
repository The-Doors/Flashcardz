# Build stage
FROM node:22-alpine AS build

WORKDIR /app/apps/web

# Copy package files for the web app
COPY apps/web/package*.json ./

# Install dependencies inside /app/apps/web
RUN npm install

# Copy the web app source code directly into /app/apps/web
COPY apps/web/ ./

# Run the build (generates /app/apps/web/dist)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built dist files to Nginx web root
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]