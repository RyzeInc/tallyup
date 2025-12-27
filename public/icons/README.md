# PWA Icon Generation Instructions

The PWA requires the following icons to be generated from `/public/icons/icon.svg`:

## Required Icons

1. **icon-192.png** (192x192) - Standard icon
2. **icon-512.png** (512x512) - Standard icon
3. **icon-192-maskable.png** (192x192) - Maskable with safe zone
4. **icon-512-maskable.png** (512x512) - Maskable with safe zone

## Generation Methods

### Option 1: Using ImageMagick (if available)
```bash
cd /workspaces/tallyup/public/icons

# Standard icons
convert -background none icon.svg -resize 192x192 icon-192.png
convert -background none icon.svg -resize 512x512 icon-512.png

# Maskable icons (with padding for safe zone)
convert -background none icon.svg -resize 154x154 -gravity center -extent 192x192 icon-192-maskable.png
convert -background none icon.svg -resize 410x410 -gravity center -extent 512x512 icon-512-maskable.png
```

### Option 2: Using Node.js (sharp library)
```bash
npm install sharp
node scripts/generate-icons.js
```

### Option 3: Online Tool
1. Go to https://realfavicongenerator.net/
2. Upload `/public/icons/icon.svg`
3. Download the generated icons and place in `/public/icons/`

### Option 4: Manual Design Tool
Use Figma, Sketch, or any design tool to:
1. Export icon.svg at 192x192 and 512x512
2. For maskable variants, add 10% padding (safe zone) around the design

## Maskable Icons
Maskable icons need a safe zone where the icon content is contained within 80% of the canvas (centered). This ensures the icon looks good on all device shapes.

## Testing
After generating icons, test with:
- Chrome DevTools > Application > Manifest
- Lighthouse PWA audit
- https://maskable.app/ for maskable icon validation
