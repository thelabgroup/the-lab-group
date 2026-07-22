FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv/

# Keep build config out of the public document root, then fail the build early
# if the Caddyfile is invalid rather than at container start.
RUN rm -f /srv/Dockerfile /srv/Caddyfile /srv/.dockerignore /srv/railway.json \
	&& caddy validate --config /etc/caddy/Caddyfile

EXPOSE 8080
