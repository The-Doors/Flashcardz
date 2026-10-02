# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files into apps/web
COPY apps/web/package*.json ./apps/web/

# Install dependencies inside apps/web
RUN cd apps/web && npm install

# Copy web app source files into apps/web
COPY apps/web ./apps/web

# Build the web app (outputs to /app/apps/web/dist)
RUN cd apps/web && npm run build

# Production stage
FROM nginx:alpine

# Copy built dist files to Nginx web root
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]