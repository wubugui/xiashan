#!/bin/zsh
# 录制编排：路由音频→BlackHole、起 ffmpeg(60fps 裁剪+音频)、跑 drive、优雅停止、还原音频
set -e
cd /Users/dannyteng/AIWork/xiashan

MODE="${1:-drive}"
CROP="1000:1366:120:234"     # cropW:cropH:cropX:cropY（probe 实测）
RAW="/tmp/promo_${MODE}.mp4"
FF=/opt/homebrew/bin/ffmpeg
SW=/opt/homebrew/bin/SwitchAudioSource

# 关掉/阻止屏保（空闲会盖住游戏窗口，导致录到屏保）
killall ScreenSaverEngine 2>/dev/null || true
caffeinate -dimsu -t 180 &
CAFFPID=$!
echo "屏保已驱散，caffeinate PID=$CAFFPID"

SPK=$($SW -t output -c)      # 记下当前输出设备，结束还原
echo "原输出设备: $SPK"

$SW -s "BlackHole 2ch" >/dev/null && echo "音频→BlackHole"

# 起录：屏幕[1] 与 BlackHole[0] 作为两个独立 avfoundation 输入再合流（合并采集会丢音）
$FF -y \
  -f avfoundation -capture_cursor 0 -capture_mouse_clicks 0 -framerate 60 -i "1:none" \
  -f avfoundation -i ":0" \
  -vf "crop=$CROP" -r 60 \
  -map 0:v:0 -map 1:a:0 \
  -c:v h264_videotoolbox -b:v 12M -pix_fmt yuv420p \
  -c:a aac -b:a 192k "$RAW" > /tmp/ffmpeg.log 2>&1 &
FFPID=$!
echo "ffmpeg PID=$FFPID，预热 2.5s"
sleep 2.5

# 跑演出流程
node tools/promo.mjs "$MODE" > /tmp/drive.log 2>&1
echo "drive($MODE) 结束，停止录制"

# 优雅停止 ffmpeg（finalize mp4）
kill -INT $FFPID 2>/dev/null || true
for i in {1..15}; do kill -0 $FFPID 2>/dev/null || break; sleep 0.4; done

# 还原音频输出
$SW -s "$SPK" >/dev/null && echo "音频已还原: $SPK"
kill $CAFFPID 2>/dev/null || true

ls -la "$RAW"
echo "RECORD_DONE"
