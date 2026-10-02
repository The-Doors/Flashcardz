# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy root package files (and install root dependencies if needed)
COPY package*.json ./
RUN npm install

# Copy web app package files into apps/web
COPY apps/web/package*.json ./apps/web/

# Move into apps/web and install its dependencies
WORKDIR /app/apps/web
RUN npm install

# Move back to root and copy all source files
WORKDIR /app
COPY . .

# Move back into apps/web to build
WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]