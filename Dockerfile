# Static build served by Caddy, which also proxies /api to the GATEWAY so the httpOnly session cookies stay
# first-party (P3-04 cookie mode). The gateway resolves the skin from the Host it receives: this Caddy forwards the
# browser's Host unchanged, so the same image serves any skin domain the gateway knows. Build context = this repo.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
