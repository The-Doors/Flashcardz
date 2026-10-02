# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy web app package files into apps/web
COPY apps/web/package*.json ./apps/web/

RUN npm install

# Copy all source files
COPY . .

# Move into the web app directory to run the build
WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from /app/apps/web/dist
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]