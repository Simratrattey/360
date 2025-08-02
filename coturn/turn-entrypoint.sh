#!/usr/bin/env bash
set -e

# Generate turnserver.conf from env vars
cat <<EOC > /etc/turnserver.conf
listening-port=3478
listening-ip=0.0.0.0

fingerprint
lt-cred-mech

realm=comm360
user=webrtc:webrtc

external-ip=${EXTERNAL_IP}

min-port=30000
max-port=30010

verbose
EOC

exec /usr/bin/turnserver --no-cli --log-file=stdout --syslog