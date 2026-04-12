/**
 * Generate PNG icons for PWA compatibility.
 * Prefer a raster source image when present so installed icons match the chosen artwork.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { existsSync, readFileSync } from 'fs'
import { basename, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(__dirname, '../public/icons')
const pngSourcePath = resolve(iconsDir, 'icon-source.png')
const svgSourcePath = resolve(iconsDir, 'icon-512.svg')
const sourcePath = existsSync(pngSourcePath) ? pngSourcePath : svgSourcePath
const sourceBuffer = readFileSync(sourcePath)

const sizes = [192, 512]

console.log(`Using ${basename(sourcePath)}`)

for (const size of sizes) {
  await sharp(sourceBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(iconsDir, `icon-${size}.png`))
  console.log(`Generated icon-${size}.png`)
}

console.log('Done.')
