#!/usr/bin/env sh
# kindle-dash settings for the entrance display.
# Copy this file over /mnt/us/dashboard/local/env.sh on the Kindle.

export WIFI_TEST_IP=${WIFI_TEST_IP:-1.1.1.1}

# Wake up every 4 hours. 07:00 is in the list so the screen is fresh
# before you leave in the morning - shift the hours to match your routine
# (and keep config.json "refreshHours" in sync so "Next ..." is right).
export REFRESH_SCHEDULE=${REFRESH_SCHEDULE:-"0 3,7,11,15,19,23 * * *"}
export TIMEZONE=${TIMEZONE:-"Europe/Zurich"}

# 1 = full (flashing) e-ink refresh on every update after the first.
# With only 6 updates a day this keeps the screen free of ghosting.
export FULL_DISPLAY_REFRESH_RATE=${FULL_DISPLAY_REFRESH_RATE:-1}

# IMPORTANT: must be larger than the gap between refreshes (4h = 14400s),
# otherwise kindle-dash shows its "sleeping" image instead of the dashboard.
export SLEEP_SCREEN_INTERVAL=20000

export LOW_BATTERY_REPORTING=${LOW_BATTERY_REPORTING:-false}
export LOW_BATTERY_THRESHOLD_PERCENT=10
