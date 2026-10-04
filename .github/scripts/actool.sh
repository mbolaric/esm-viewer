#!/bin/sh

# The Node-based Tauri CLI can close inherited stdin; actool requires it to be open.
exec xcrun actool "$@" < /dev/null
