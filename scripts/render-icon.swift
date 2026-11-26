import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// 绘制 HyBrand 应用图标，圆角外保持透明。
// 用法: swift scripts/render-icon.swift <输出 PNG 路径>

let size = 1024
let output = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon-1024.png"

guard let space = CGColorSpace(name: CGColorSpace.sRGB),
      let context = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ) else {
    fputs("无法创建绘图上下文\n", stderr)
    exit(1)
}

// 翻转为左上角原点，与设计稿坐标一致
context.translateBy(x: 0, y: CGFloat(size))
context.scaleBy(x: 1, y: -1)

let appRect = CGRect(x: 64, y: 64, width: 896, height: 896)
let rounded = CGPath(
    roundedRect: appRect,
    cornerWidth: 224,
    cornerHeight: 224,
    transform: nil
)

context.saveGState()
context.addPath(rounded)
context.clip()

let backgroundColors = [
    CGColor(srgbRed: 0x7c / 255.0, green: 0x8b / 255.0, blue: 0xff / 255.0, alpha: 1),
    CGColor(srgbRed: 0x46 / 255.0, green: 0x53 / 255.0, blue: 0xeb / 255.0, alpha: 1)
] as CFArray
if let gradient = CGGradient(colorsSpace: space, colors: backgroundColors, locations: [0, 1]) {
    context.drawLinearGradient(
        gradient,
        start: CGPoint(x: 64, y: 64),
        end: CGPoint(x: 960, y: 960),
        options: []
    )
}

let shineColors = [
    CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.16),
    CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0)
] as CFArray
if let shine = CGGradient(colorsSpace: space, colors: shineColors, locations: [0, 1]) {
    context.drawLinearGradient(
        shine,
        start: CGPoint(x: 64, y: 64),
        end: CGPoint(x: 64, y: 512),
        options: []
    )
}
context.restoreGState()

// H 字标
context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
for bar in [
    CGRect(x: 298, y: 300, width: 104, height: 424),
    CGRect(x: 622, y: 300, width: 104, height: 424),
    CGRect(x: 402, y: 460, width: 220, height: 104)
] {
    context.addPath(CGPath(roundedRect: bar, cornerWidth: 28, cornerHeight: 28, transform: nil))
}
context.fillPath()

// 星芒
let sparkle = CGMutablePath()
sparkle.move(to: CGPoint(x: 804, y: 238))
sparkle.addLine(to: CGPoint(x: 822, y: 290))
sparkle.addLine(to: CGPoint(x: 874, y: 308))
sparkle.addLine(to: CGPoint(x: 822, y: 326))
sparkle.addLine(to: CGPoint(x: 804, y: 378))
sparkle.addLine(to: CGPoint(x: 786, y: 326))
sparkle.addLine(to: CGPoint(x: 734, y: 308))
sparkle.addLine(to: CGPoint(x: 786, y: 290))
sparkle.closeSubpath()
context.setFillColor(CGColor(srgbRed: 0xd9 / 255.0, green: 1, blue: 0xef / 255.0, alpha: 1))
context.addPath(sparkle)
context.fillPath()

context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.85))
context.fillEllipse(in: CGRect(x: 790, y: 294, width: 28, height: 28))

guard let image = context.makeImage() else {
    fputs("无法生成图像\n", stderr)
    exit(1)
}

let url = URL(fileURLWithPath: output)
try? FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(),
    withIntermediateDirectories: true
)

guard let destination = CGImageDestinationCreateWithURL(
    url as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fputs("无法创建 PNG 输出\n", stderr)
    exit(1)
}

CGImageDestinationAddImage(destination, image, nil)
if !CGImageDestinationFinalize(destination) {
    fputs("写入 PNG 失败\n", stderr)
    exit(1)
}

print(output)
