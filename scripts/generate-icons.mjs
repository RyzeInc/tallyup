/**
 * Generate PWA icons from SVG source
 * Usage: node scripts/generate-icons.mjs
 *
 * Requires: npm install sharp
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, "../public/icons");
const SOURCE_SVG = path.join(ICONS_DIR, "icon.svg");

const icons = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-192-maskable.png", size: 192, maskable: true },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
];

async function generateIcons() {
  console.log("🎨 Generating PWA icons...\n");

  if (!fs.existsSync(SOURCE_SVG)) {
    console.error(`❌ Source SVG not found: ${SOURCE_SVG}`);
    process.exit(1);
  }

  for (const icon of icons) {
    try {
      const outputPath = path.join(ICONS_DIR, icon.name);

      if (icon.maskable) {
        // Maskable icons need 10% safe zone (content in 80% of canvas)
        const contentSize = Math.floor(icon.size * 0.8);
        const padding = Math.floor((icon.size - contentSize) / 2);

        await sharp(SOURCE_SVG)
          .resize(contentSize, contentSize)
          .extend({
            top: padding,
            bottom: padding,
            left: padding,
            right: padding,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toFile(outputPath);
      } else {
        // Standard icons
        await sharp(SOURCE_SVG)
          .resize(icon.size, icon.size)
          .png()
          .toFile(outputPath);
      }

      console.log(
        `✅ Generated: ${icon.name} (${icon.size}x${icon.size}${icon.maskable ? ", maskable" : ""})`
      );
    } catch (error) {
      console.error(`❌ Failed to generate ${icon.name}:`, (error as Error).message);
    }
  }

  console.log("\n✨ Icon generation complete!");
}

generateIcons().catch((error) => {
  console.error("❌ Icon generation failed:", error);
  process.exit(1);
});
