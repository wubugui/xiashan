#!/bin/zsh
# 一键更新线上版:构建 → 精简 → 压缩 → 传到新加坡服务器 → 重载 nginx
# 用法： zsh tools/deploy-to-server.sh
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
FF=/opt/homebrew/bin/ffmpeg
SERVER="admin@47.116.0.213"
KEY="$HOME/.ssh/id_ed25519"
WEBROOT="/usr/share/nginx/html"
SSH="ssh -i $KEY -o BatchMode=yes"

echo "▶ 1/4 构建源码"
npm run build >/dev/null 2>&1

echo "▶ 2/4 精简到 deploy/"
# 用 tar 同步 dist→deploy（保留 deploy/.git 不动）
rm -rf /tmp/_xs_deploy && cp -R dist /tmp/_xs_deploy
rm -rf /tmp/_xs_deploy/characters/setting /tmp/_xs_deploy/characters/face/source
find /tmp/_xs_deploy -name "*.map" -delete
rm -f /tmp/_xs_deploy/audio/1.mp3
find /tmp/_xs_deploy -name ".DS_Store" -o -name "._*" -delete 2>/dev/null || true

echo "▶ 3/4 压缩资源"
find /tmp/_xs_deploy -name "*.png" -print0 | xargs -0 pngquant --quality=65-88 --skip-if-larger --force --ext .png 2>/dev/null || true
find /tmp/_xs_deploy \( -name "*.jpg" -o -name "*.jpeg" \) -print0 | xargs -0 jpegoptim --max=82 --strip-all --quiet 2>/dev/null || true
[ -f /tmp/_xs_deploy/audio/bgm.mp3 ] && $FF -y -i /tmp/_xs_deploy/audio/bgm.mp3 -b:a 128k -map_metadata -1 /tmp/_bgm.mp3 >/dev/null 2>&1 && mv /tmp/_bgm.mp3 /tmp/_xs_deploy/audio/bgm.mp3
for v in /tmp/_xs_deploy/video/*.mp4(N); do
  $FF -y -i "$v" -vf "scale=-2:'min(720,ih)'" -c:v libx264 -crf 26 -preset medium -c:a aac -b:a 128k -movflags +faststart /tmp/_v.mp4 >/dev/null 2>&1 && mv /tmp/_v.mp4 "$v"
done
echo "  发布体积: $(du -sh /tmp/_xs_deploy | cut -f1)"

echo "▶ 4/4 传到服务器并重载"
${=SSH} $SERVER "rm -rf $WEBROOT/* && mkdir -p $WEBROOT"
tar czf - -C /tmp/_xs_deploy --exclude='._*' . | ${=SSH} $SERVER "tar xzf - -C $WEBROOT 2>/dev/null; find $WEBROOT -name '._*' -delete; sudo systemctl reload nginx; echo DONE"
echo "✅ 线上已更新： http://47.116.0.213:8080/"
