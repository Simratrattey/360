#!/bin/sh

# ✅ Replace ${PORT} in nginx.conf.template with the real $PORT Render provides
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# ✅ Start backend in background
cd webrtc-signaling-server
npm start &

# ✅ Start nginx in foreground (so container stays alive)
nginx -g "daemon off;"
