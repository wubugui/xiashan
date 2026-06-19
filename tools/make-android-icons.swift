// 从一张方形源图生成安卓 launcher 图标（各密度）：
//   ic_launcher.png            方形满版（旧版/通用）
//   ic_launcher_round.png      圆形遮罩（旧版圆形启动器）
//   ic_launcher_foreground.png 自适应前景满版（API 26+，系统按设备形状裁切）
// 用法: swift tools/make-android-icons.swift <源图.png> <android/app/src/main/res>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 3 else { FileHandle.standardError.write("用法: make-android-icons.swift <src.png> <resDir>\n".data(using: .utf8)!); exit(2) }
let srcPath = args[1], resDir = args[2]

guard let srcData = FileManager.default.contents(atPath: srcPath),
      let srcSrc = CGImageSourceCreateWithData(srcData as CFData, nil),
      let src = CGImageSourceCreateImageAtIndex(srcSrc, 0, nil) else {
  FileHandle.standardError.write("无法读取源图: \(srcPath)\n".data(using: .utf8)!); exit(1)
}

let colorSpace = CGColorSpaceCreateDeviceRGB()

func render(size: Int, round: Bool) -> CGImage? {
  guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                            bytesPerRow: 0, space: colorSpace,
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
  ctx.interpolationQuality = .high
  let rect = CGRect(x: 0, y: 0, width: size, height: size)
  if round { ctx.addEllipse(in: rect); ctx.clip() }
  // 源图为正方形 → 直接铺满即可；CoreGraphics 默认正向绘制，无需翻转
  ctx.draw(src, in: rect)
  return ctx.makeImage()
}

func write(_ image: CGImage, to path: String) {
  let url = URL(fileURLWithPath: path)
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
  CGImageDestinationAddImage(dest, image, nil)
  CGImageDestinationFinalize(dest)
}

// (密度目录, 旧版尺寸, 自适应前景尺寸)
let densities: [(String, Int, Int)] = [
  ("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
  ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432),
]

for (d, legacy, fg) in densities {
  let dir = "\(resDir)/mipmap-\(d)"
  try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
  if let sq = render(size: legacy, round: false) { write(sq, to: "\(dir)/ic_launcher.png") }
  if let rd = render(size: legacy, round: true)  { write(rd, to: "\(dir)/ic_launcher_round.png") }
  if let fgi = render(size: fg, round: false)    { write(fgi, to: "\(dir)/ic_launcher_foreground.png") }
  print("✓ mipmap-\(d): launcher=\(legacy) round=\(legacy) foreground=\(fg)")
}
print("完成")
