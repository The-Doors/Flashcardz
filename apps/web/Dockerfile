# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy web app package files into apps/web
COPY apps/web/package*.json ./apps/web/

RUN npm install

# Copy remaining source files
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]