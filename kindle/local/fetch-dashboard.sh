#!/usr/bin/env sh
# Downloads the dashboard PNG to "$1". A non-zero exit leaves the old image on screen.
#
# Pick ONE URL:
#   Laptop server:  http://192.168.1.50:8080/dashboard.png   (use your laptop's LAN IP)
#   GitHub Pages:   https://<your-user>.github.io/<repo>/dashboard.png
DASHBOARD_URL="http://192.168.1.50:8080/dashboard.png"

"$(dirname "$0")/../xh" -d -q --check-status --timeout 30 -o "$1" get "$DASHBOARD_URL?t=$(date +%s)"
