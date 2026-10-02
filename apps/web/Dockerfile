# Build stage
FROM node:22-alpine AS build

WORKDIR /app/apps/web

# Install from the web app lockfile for reproducible builds.
COPY apps/web/package*.json ./
RUN npm ci

# Copy remaining source files
COPY apps/web ./

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
