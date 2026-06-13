import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import Vision

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let inputDir = root.appendingPathComponent("public/bg/gacha", isDirectory: true)
let outputDir = root.appendingPathComponent("public/bg/gacha-silhouette", isDirectory: true)
let fm = FileManager.default

try fm.createDirectory(at: outputDir, withIntermediateDirectories: true)

let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
let context = CIContext(options: [.workingColorSpace: colorSpace, .outputColorSpace: colorSpace])
let files = try fm.contentsOfDirectory(at: inputDir, includingPropertiesForKeys: nil)
  .filter { ["jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

func writeSilhouette(inputURL: URL, outputURL: URL) throws {
  guard #available(macOS 14.0, *) else {
    throw NSError(domain: "GachaSilhouette", code: 1, userInfo: [
      NSLocalizedDescriptionKey: "VNGenerateForegroundInstanceMaskRequest requires macOS 14 or newer.",
    ])
  }

  guard let sourceImage = CIImage(contentsOf: inputURL) else {
    throw NSError(domain: "GachaSilhouette", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "Cannot read image: \(inputURL.path)",
    ])
  }

  let handler = VNImageRequestHandler(url: inputURL)
  let request = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])

  guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
    throw NSError(domain: "GachaSilhouette", code: 3, userInfo: [
      NSLocalizedDescriptionKey: "No foreground instance detected: \(inputURL.lastPathComponent)",
    ])
  }

  let maskBuffer = try observation.generateScaledMaskForImage(
    forInstances: observation.allInstances,
    from: handler
  )
  let maskImage = CIImage(cvPixelBuffer: maskBuffer)
    .cropped(to: sourceImage.extent)

  let black = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 1))
    .cropped(to: sourceImage.extent)

  let maskToAlpha = CIFilter.maskToAlpha()
  maskToAlpha.inputImage = maskImage

  let sourceIn = CIFilter.sourceInCompositing()
  sourceIn.inputImage = black
  sourceIn.backgroundImage = maskToAlpha.outputImage?.cropped(to: sourceImage.extent)

  guard let outputImage = sourceIn.outputImage?.cropped(to: sourceImage.extent) else {
    throw NSError(domain: "GachaSilhouette", code: 4, userInfo: [
      NSLocalizedDescriptionKey: "Cannot compose silhouette: \(inputURL.lastPathComponent)",
    ])
  }

  try context.writePNGRepresentation(
    of: outputImage,
    to: outputURL,
    format: .RGBA8,
    colorSpace: colorSpace
  )
}

var ok = 0
var failed = 0

for file in files {
  let outputName = file.deletingPathExtension().lastPathComponent + ".png"
  let outputURL = outputDir.appendingPathComponent(outputName)
  do {
    try writeSilhouette(inputURL: file, outputURL: outputURL)
    ok += 1
    print("ok \(file.lastPathComponent) -> \(outputURL.lastPathComponent)")
  } catch {
    failed += 1
    print("fail \(file.lastPathComponent): \(error.localizedDescription)")
  }
}

print("generated \(ok), failed \(failed)")
if failed > 0 {
  exit(1)
}
