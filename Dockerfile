# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies from the committed lockfile (npm ci, not npm install) so the
# exact-pinned, registry-verified dependency tree is authoritative (supply-chain pin).
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the static SPA.
COPY . .

# VITE_API_URL is baked into the static JS at THIS step (build time, import.meta.env).
# It is NOT runtime-configurable — reconfiguring the backend requires a rebuild
# (docker build --build-arg VITE_API_URL=...). Declared BEFORE `npm run build`.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build
# -> /app/dist (index.html + hashed chunks)

# ---- serve stage (non-root) ----
# nginxinc/nginx-unprivileged already runs as UID 101 (non-root) and listens on 8080.
# Do NOT escalate to a privileged user and do NOT change the port to 80.
FROM nginxinc/nginx-unprivileged:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# CMD inherited from the base image: nginx -g 'daemon off;'
