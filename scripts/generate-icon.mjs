import fs from 'node:fs'
import path from 'node:path'
import { deflateSync } from 'node:zlib'

const SIZE = 256
const SAMPLES = 4
const OUT_DIR = path.resolve('build')

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const cx = clamp(x, left + radius, right - radius)
  const cy = clamp(y, top + radius, bottom - radius)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function insideTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by)
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy)
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay)
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNegative && hasPositive)
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ]
}

function buildPixels() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4)
  const start = [10, 132, 255]
  const end = [123, 97, 255]
  const white = [255, 255, 255]

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const px = x + (sx + 0.5) / SAMPLES
          const py = y + (sy + 0.5) / SAMPLES
          if (!insideRoundedRect(px, py, 8, 8, 248, 248, 58)) continue

          const t = clamp((px + py - 16) / (SIZE * 2 - 32), 0, 1)
          let color = mix(start, end, t)
          const highlight = clamp(1 - (px + py) / (SIZE * 1.5), 0, 1) * 0.18
          color = mix(color, white, highlight)

          const stem =
            insideRoundedRect(px, py, 119, 52, 137, 132, 9) ||
            insideTriangle(px, py, 88, 106, 168, 106, 128, 162) ||
            insideRoundedRect(px, py, 74, 176, 182, 196, 10)
          if (stem) color = mix(color, white, 0.97)

          r += color[0]
          g += color[1]
          b += color[2]
          a += 1
        }
      }

      const samples = SAMPLES * SAMPLES
      const offset = (y * SIZE + x) * 4
      if (a > 0) {
        pixels[offset] = Math.round(r / a)
        pixels[offset + 1] = Math.round(g / a)
        pixels[offset + 2] = Math.round(b / a)
        pixels[offset + 3] = Math.round((a / samples) * 255)
      }
    }
  }
  return pixels
}

function buildIco(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0
  entry[1] = 0
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const pixels = buildPixels()
const png = encodePng(SIZE, SIZE, pixels)
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), png)
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), buildIco(png))
console.log(`Generated build/icon.png and build/icon.ico (${SIZE}x${SIZE})`)
