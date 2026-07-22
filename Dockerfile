# Stage 1 assembles the public document root. The build config is stripped here
# rather than in the final stage because caddy:alpine declares /srv as a VOLUME,
# which silently discards RUN-layer changes made to it (COPY still persists).
FROM node:22-alpine AS site
WORKDIR /site
COPY . .

# Regenerate the search index from the pages as they exist in this build. The
# committed copy is only there for local preview — building it here is what
# stops a re-export from shipping results that point at stale content.
RUN node tools/build-search-index.mjs \
 && rm -rf tools \
 && rm -f Dockerfile Caddyfile .dockerignore railway.json

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=site /site /srv/

# Fail the build on an invalid Caddyfile rather than at container start.
RUN caddy validate --config /etc/caddy/Caddyfile

EXPOSE 8080
