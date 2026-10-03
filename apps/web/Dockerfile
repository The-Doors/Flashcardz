FROM node:22-alpine AS build

WORKDIR /app

COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM node:22-alpine AS web

WORKDIR /app

COPY --from=build /app/.output ./.output

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]

FROM nginx:alpine AS proxy

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80