FROM debian:stable-slim

# Install coturn
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y coturn \
 && rm -rf /var/lib/apt/lists/*

# Copy our startup script
COPY coturn/turn-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/turn-entrypoint.sh

# Expose TURN ports
EXPOSE 3478/tcp 3478/udp

ENTRYPOINT ["turn-entrypoint.sh"]