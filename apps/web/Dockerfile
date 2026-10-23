FROM node:22-alpine AS build

WORKDIR /app

COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY"
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM node:22-alpine AS web

WORKDIR /app

COPY --from=build /app/.output ./.output

ENV NODE_ENV=production

USER node

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e 'fetch("http://127.0.0.1:3000/").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

CMD ["node", ".output/server/index.mjs"]

FROM nginx:alpine AS proxy

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/
