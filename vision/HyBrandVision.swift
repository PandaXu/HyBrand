import Foundation
import Vision
import ImageIO
import AVFoundation
import CoreGraphics
import UniformTypeIdentifiers

// HyBrand 本地图像分析助手。
// 用法: hybrand-vision analyze <文件路径>
// 输出: JSON { labels, feature, featureCount, width, height, duration, colors }

func emit(_ object: [String: Any], exitCode: Int32 = 0) -> Never {
    if let data = try? JSONSerialization.data(withJSONObject: object),
       let text = String(data: data, encoding: .utf8) {
        print(text)
    }
    exit(exitCode)
}

func fail(_ message: String) -> Never {
    emit(["error": message], exitCode: 2)
}

func hexString(_ r: Int, _ g: Int, _ b: Int) -> String {
    String(format: "#%02X%02X%02X", max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
}

func dominantColors(_ image: CGImage, wanted: Int = 3) -> [String] {
    let side = 16
    var pixels = [UInt8](repeating: 0, count: side * side * 4)
    guard let space = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: &pixels,
            width: side,
            height: side,
            bitsPerComponent: 8,
            bytesPerRow: side * 4,
            space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          ) else { return [] }

    context.interpolationQuality = .low
    context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))

    var buckets: [Int: (count: Int, r: Int, g: Int, b: Int)] = [:]
    var index = 0
    while index < pixels.count {
        let r = Int(pixels[index])
        let g = Int(pixels[index + 1])
        let b = Int(pixels[index + 2])
        let a = Int(pixels[index + 3])
        index += 4
        if a < 128 { continue }
        let key = (r / 32) << 6 | (g / 32) << 3 | (b / 32)
        var entry = buckets[key] ?? (0, 0, 0, 0)
        entry.count += 1
        entry.r += r
        entry.g += g
        entry.b += b
        buckets[key] = entry
    }

    var result: [String] = []
    var picked: [(Int, Int, Int)] = []
    for entry in buckets.values.sorted(by: { $0.count > $1.count }) {
        if result.count >= wanted { break }
        let r = entry.r / max(1, entry.count)
        let g = entry.g / max(1, entry.count)
        let b = entry.b / max(1, entry.count)
        let close = picked.contains { abs($0.0 - r) < 24 && abs($0.1 - g) < 24 && abs($0.2 - b) < 24 }
        if close { continue }
        picked.append((r, g, b))
        result.append(hexString(r, g, b))
    }
    return result
}

func flattened(_ image: CGImage) -> CGImage {
    guard let space = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: nil,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: space,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
          ) else { return image }
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: image.width, height: image.height))
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    return context.makeImage() ?? image
}

func writePreview(_ image: CGImage, to path: String) {
    let url = URL(fileURLWithPath: path)
    let directory = url.deletingLastPathComponent()
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    guard let destination = CGImageDestinationCreateWithURL(
        url as CFURL,
        UTType.jpeg.identifier as CFString,
        1,
        nil
    ) else { return }
    let options = [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary
    CGImageDestinationAddImage(destination, flattened(image), options)
    CGImageDestinationFinalize(destination)
}

func analyzeImage(_ url: URL, output: inout [String: Any], previewPath: String?) -> Bool {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return false }

    if let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] {
        if let width = properties[kCGImagePropertyPixelWidth] as? Int,
           let height = properties[kCGImagePropertyPixelHeight] as? Int,
           width > 0, height > 0 {
            output["width"] = width
            output["height"] = height
        }
    }

    let thumbnailOptions: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: 1600
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions as CFDictionary)
        ?? CGImageSourceCreateImageAtIndex(source, 0, nil) else { return false }

    if let previewPath {
        writePreview(image, to: previewPath)
    }

    var labels: [[String: Any]] = []
    var feature: String? = nil
    var featureCount = 0

    let handler = VNImageRequestHandler(cgImage: image, options: [:])

    let classify = VNClassifyImageRequest()
    do {
        try handler.perform([classify])
        let sorted = (classify.results ?? []).sorted { $0.confidence > $1.confidence }
        for observation in sorted.prefix(12) {
            labels.append([
                "id": observation.identifier,
                "confidence": Double(observation.confidence)
            ])
        }
    } catch {
        // 分类失败不影响尺寸与特征提取
    }

    let featureRequest = VNGenerateImageFeaturePrintRequest()
    do {
        try handler.perform([featureRequest])
        if let observation = featureRequest.results?.first as? VNFeaturePrintObservation {
            var floats: [Float] = []
            if observation.elementType == .float {
                floats = observation.data.withUnsafeBytes { raw in
                    Array(raw.bindMemory(to: Float.self)) as [Float]
                }
            } else if observation.elementType == .double {
                floats = observation.data.withUnsafeBytes { raw in
                    raw.bindMemory(to: Double.self).map { Float($0) } as [Float]
                }
            }
            if !floats.isEmpty {
                let data = floats.withUnsafeBufferPointer { Data(buffer: $0) }
                feature = data.base64EncodedString()
                featureCount = floats.count
            }
        }
    } catch {
        // 特征提取失败时仍保留标签与颜色
    }

    output["labels"] = labels
    if let feature { output["feature"] = feature }
    if featureCount > 0 { output["featureCount"] = featureCount }
    output["colors"] = dominantColors(image)
    return true
}

func analyzeAV(_ url: URL, output: inout [String: Any]) -> Bool {
    let asset = AVURLAsset(url: url)
    var found = false

    let duration = CMTimeGetSeconds(asset.duration)
    if duration.isFinite && duration > 0 {
        output["duration"] = duration
        found = true
    }

    if let track = asset.tracks(withMediaType: .video).first {
        let size = track.naturalSize.applying(track.preferredTransform)
        let width = abs(size.width)
        let height = abs(size.height)
        if width > 0 && height > 0 {
            output["width"] = Int(width.rounded())
            output["height"] = Int(height.rounded())
            found = true
        }
    }

    return found
}

let arguments = CommandLine.arguments
guard arguments.count >= 3, arguments[1] == "analyze" else {
    fail("usage: hybrand-vision analyze <path>")
}

let url = URL(fileURLWithPath: arguments[2])
let previewPath = arguments.count >= 4 ? arguments[3] : nil
guard FileManager.default.fileExists(atPath: url.path) else {
    fail("file not found")
}

var output: [String: Any] = ["labels": [], "colors": []]
let imageOK = analyzeImage(url, output: &output, previewPath: previewPath)
let avOK = analyzeAV(url, output: &output)

if !imageOK && !avOK {
    fail("unsupported file")
}

emit(output)
