#!/usr/bin/env bash
echo "🔧 turn-entrypoint.sh is running"
set -e

PRIVATE_IP=$(ip route get 8.8.8.8 \
             | awk '/src/ { print $7; exit }')

echo "→ Detected PRIVATE_IP: $PRIVATE_IP"

# Generate turnserver.conf from env vars
cat <<EOC > /etc/turnserver.conf
listening-port=3478
listening-ip=0.0.0.0

fingerprint
lt-cred-mech

realm=comm360
user=webrtc:webrtc

external-ip=131.153.168.218/${PRIVATE_IP}

min-port=30000
max-port=30010

verbose
EOC

exec /usr/bin/turnserver --no-cli --log-file=stdout --syslog