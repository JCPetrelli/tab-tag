#!/bin/sh
# Writes iTerm2's tab escapes to the terminal the session runs in.
#   tab.sh title <text> | color <red> <green> <blue> | reset
[ "$TERM_PROGRAM" = "iTerm.app" ] || exit 0

# The caller has no controlling terminal: walk up to the first ancestor that has one.
pid=$$
tty=
while [ -n "$pid" ] && [ "$pid" != "1" ]; do
  name=$(ps -o tty= -p "$pid" | tr -d ' ')
  case "$name" in
    '' | '??') ;;
    *) tty="/dev/$name"; break ;;
  esac
  pid=$(ps -o ppid= -p "$pid" | tr -d ' ')
done
[ -n "$tty" ] && [ -w "$tty" ] || exit 3

case "$1" in
  title) printf '\033]1;%s\007' "$2" > "$tty" ;;
  color)
    printf '\033]6;1;bg;red;brightness;%s\007' "$2" > "$tty"
    printf '\033]6;1;bg;green;brightness;%s\007' "$3" > "$tty"
    printf '\033]6;1;bg;blue;brightness;%s\007' "$4" > "$tty"
    ;;
  reset) printf '\033]6;1;bg;*;default\007\033]1;\007' > "$tty" ;;
esac
