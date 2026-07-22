# Stage 1 assembles the public document root. The build config is stripped here
# rather than in the final stage because caddy:alpine declares /srv as a VOLUME,
# which silently discards RUN-layer changes made to it (COPY still persists).
FROM alpine:3 AS site
WORKDIR /site
COPY . .
RUN rm -f Dockerfile Caddyfile .dockerignore railway.json

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=site /site /srv/

# Fail the build on an invalid Caddyfile rather than at container start.
RUN caddy validate --config /etc/caddy/Caddyfile

EXPOSE 8080
