#!/bin/bash
# Generate simple PNG icons using ImageMagick (if available)
# Or use any icon generation tool. Placeholder SVGs are fine for dev.
for size in 16 32 48 128; do
  convert -size ${size}x${size} xc:#2563eb \
    -fill white -gravity center \
    -pointsize $((size/2)) -annotate 0 '$' \
    public/icons/icon${size}.png 2>/dev/null || \
  # Fallback: copy a placeholder SVG as PNG filename (Chrome will warn but load)
  cp public/icons/icon.svg public/icons/icon${size}.png 2>/dev/null || true
done
