#!/bin/zsh
# 一键发布：构建源码 → 精简 → 压缩 → 推送到发布仓库(xiashan-release) → 帽子云自动重新部署
# 用法： zsh tools/publish.sh
set -e
cd "$(dirname "$0")/.."        # 切到项目根
ROOT=$(pwd)
FF=/opt/homebrew/bin/ffmpeg

echo "▶ 1/5 构建源码 (npm run build)"
npm run build >/dev/null 2>&1
echo "  ✓ dist 生成"

echo "▶ 2/5 同步到 deploy/（保留 .git 发布仓库）"
# deploy/ 已是指向 xiashan-release 的 git 仓库；用 rsync 覆盖内容但保留 .git / README / .gitignore
rsync -a --delete \
  --exclude='.git' --exclude='.gitignore' --exclude='README.md' \
  "$ROOT/dist/" "$ROOT/deploy/"

echo "▶ 3/5 剔除运行时无用大文件"
rm -rf deploy/characters/setting        # 全身设定图（未接入运行态）
rm -rf deploy/characters/face/source     # 切图源稿（清单未引用，运行时不用）
find deploy -name "*.map" -delete        # sourcemap
rm -f deploy/audio/1.mp3                  # 无引用音频
find deploy -name ".DS_Store" -delete

echo "▶ 4/5 压缩资源"
find deploy -name "*.png" -print0 | xargs -0 pngquant --quality=65-88 --skip-if-larger --force --ext .png 2>/dev/null || true
find deploy \( -name "*.jpg" -o -name "*.jpeg" \) -print0 | xargs -0 jpegoptim --max=82 --strip-all --quiet 2>/dev/null || true
# BGM → 128k
[ -f deploy/audio/bgm.mp3 ] && $FF -y -i deploy/audio/bgm.mp3 -b:a 128k -map_metadata -1 /tmp/_bgm.mp3 >/dev/null 2>&1 && mv /tmp/_bgm.mp3 deploy/audio/bgm.mp3
# 视频 → ≤720p CRF26 faststart
for v in deploy/video/*.mp4(N); do
  $FF -y -i "$v" -vf "scale=-2:'min(720,ih)'" -c:v libx264 -crf 26 -preset medium -c:a aac -b:a 128k -movflags +faststart /tmp/_v.mp4 >/dev/null 2>&1 && mv /tmp/_v.mp4 "$v"
done
echo "  ✓ 压缩完成，发布体积: $(du -sh deploy | cut -f1)"

echo "▶ 5/5 推送到发布仓库"
cd deploy
git add -A
if git diff --cached --quiet; then
  echo "  • 内容无变化，跳过推送"
else
  git -c user.name="wubugui" -c user.email="wubuguiqazwsxmail@gmail.com" commit -q -m "release: $(date '+%Y-%m-%d %H:%M') 更新发布版"
  git push -q origin main
  echo "  ✓ 已推送 → 帽子云将自动重新部署"
fi
echo "✅ 发布完成"
