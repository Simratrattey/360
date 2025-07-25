#!/usr/bin/env bash
set -e

# Generate turnserver.conf from env vars
cat <<EOC > /etc/turnserver.conf
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=${TURN_SECRET}
realm=comm360
external-ip=${EXTERNAL_IP}
verbose
EOC

exec /usr/bin/turnserver --no-cli --log-file=stdout --syslog
