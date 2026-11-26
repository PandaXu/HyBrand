import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resources = path.join(root, 'resources')
const iconset = path.join(resources, 'icon.iconset')
const icns = path.join(resources, 'icon.icns')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-icon-'))
const source = path.join(tmp, 'icon-1024.png')

try {
  fs.mkdirSync(resources, { recursive: true })

  // CoreGraphics 直接绘制，圆角外为透明像素
  execFileSync('/usr/bin/swift', [path.join(root, 'scripts', 'render-icon.swift'), source], {
    stdio: 'ignore'
  })

  fs.rmSync(iconset, { recursive: true, force: true })
  fs.mkdirSync(iconset, { recursive: true })

  const sizes = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]

  for (const [name, size] of sizes) {
    execFileSync(
      '/usr/bin/sips',
      ['-z', String(size), String(size), source, '--out', path.join(iconset, name)],
      { stdio: 'ignore' }
    )
  }

  execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', icns], {
    stdio: 'ignore'
  })
  console.log(`已生成 ${path.relative(root, icns)}`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.rmSync(iconset, { recursive: true, force: true })
}
