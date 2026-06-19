#!/usr/bin/env bash
# ============================================================================
#  一键打包：把 Web 构建打成安卓 Release APK（TapTap 官网包）
#
#  用法：
#    tools/build-apk.sh                 # 构建 Web → 同步 → 打 release APK
#    tools/build-apk.sh --bump          # 先把 VersionCode +1，再打包（发新版用）
#    tools/build-apk.sh --version-name 1.1.0   # 同时设置展示版本名
#    tools/build-apk.sh --no-web        # 跳过 Web 构建，直接用现有 dist/ 打包
#    tools/build-apk.sh --aab           # 额外产出 AAB（如需 Google Play 渠道）
#
#  产物：dist-apk/二十五时便利屋-v<名>-<码>.apk
#
#  规范要点（TapTap）：
#    · 产物为架构无关 APK，兼容 64 位与 32 位（绝不仅 32 位）
#    · VersionCode 必须 > 0 且 >= 线上版本；用 --bump 递增
#    · 包名 com.ershiwushi.bianliwu 上线后永不可改
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── 解析参数 ────────────────────────────────────────────────────────────────
DO_BUMP=0
DO_WEB=1
DO_AAB=0
NEW_VERSION_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bump)          DO_BUMP=1; shift ;;
    --no-web)        DO_WEB=0; shift ;;
    --aab)           DO_AAB=1; shift ;;
    --version-name)  NEW_VERSION_NAME="${2:-}"; shift 2 ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

# ── 工具链环境 ──────────────────────────────────────────────────────────────
# JAVA_HOME：Capacitor 8 需要 JDK 21。优先 Homebrew openjdk@21。
for cand in \
  /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 \
  "${JAVA_HOME:-}"; do
  if [[ -n "$cand" && -x "$cand/bin/javac" ]]; then export JAVA_HOME="$cand"; break; fi
done
[[ -x "${JAVA_HOME:-}/bin/java" ]] || { echo "❌ 找不到 JDK21（Capacitor 8 必需），请先 brew install openjdk@21"; exit 1; }
export PATH="$JAVA_HOME/bin:$PATH"
JV="$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
case "$JV" in *\"21*|*\"24*) : ;; *) echo "⚠️  当前 JDK 非 21（$JV），Capacitor 8 编译可能失败"; ;; esac

# ANDROID_HOME / sdk.dir
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
[[ -d "$ANDROID_HOME/platform-tools" || -d "$ANDROID_HOME/cmdline-tools" ]] \
  || { echo "❌ 找不到 Android SDK（$ANDROID_HOME），请先安装 cmdline-tools/platform/build-tools"; exit 1; }
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties

echo "▸ JAVA_HOME    = $JAVA_HOME"
echo "▸ ANDROID_HOME = $ANDROID_HOME"

# 把 shell 的 HTTP(S)_PROXY 透传给 Gradle/Wrapper（Gradle 只认 JVM 系统属性，不读环境变量）。
# 镜像走阿里云/腾讯，若本机需经代理访问外网，这一步保证 wrapper 下载与依赖解析都能通。
PROXY_RAW="${HTTPS_PROXY:-${HTTP_PROXY:-${https_proxy:-${http_proxy:-}}}}"
if [[ -n "$PROXY_RAW" ]]; then
  hp="${PROXY_RAW#*://}"; hp="${hp%/}"
  PHOST="${hp%:*}"; PPORT="${hp##*:}"
  [[ "$PPORT" == "$hp" ]] && PPORT=80
  export GRADLE_OPTS="${GRADLE_OPTS:-} -Dhttp.proxyHost=$PHOST -Dhttp.proxyPort=$PPORT -Dhttps.proxyHost=$PHOST -Dhttps.proxyPort=$PPORT -Dhttp.nonProxyHosts=localhost|127.0.0.1"
  echo "▸ Gradle 代理   = $PHOST:$PPORT"
fi

# ── 版本号管理（单一来源：android/version.properties）────────────────────────
VP=android/version.properties
get_prop() { grep -E "^$1=" "$VP" | head -1 | cut -d= -f2 | tr -d ' \r'; }
set_prop() { # set_prop KEY VALUE  —— 原地替换，跨平台 sed
  local k="$1" v="$2"
  if sed --version >/dev/null 2>&1; then sed -i    "s/^$k=.*/$k=$v/" "$VP";
  else                                    sed -i '' "s/^$k=.*/$k=$v/" "$VP"; fi
}

if [[ $DO_BUMP -eq 1 ]]; then
  cur="$(get_prop VERSION_CODE)"
  set_prop VERSION_CODE "$((cur + 1))"
  echo "▸ VersionCode 递增：$cur → $((cur + 1))"
fi
if [[ -n "$NEW_VERSION_NAME" ]]; then
  set_prop VERSION_NAME "$NEW_VERSION_NAME"
  echo "▸ VersionName 设为：$NEW_VERSION_NAME"
fi

VCODE="$(get_prop VERSION_CODE)"
VNAME="$(get_prop VERSION_NAME)"
[[ "$VCODE" =~ ^[0-9]+$ && "$VCODE" -gt 0 ]] || { echo "❌ VersionCode 非法（必须 > 0）：$VCODE"; exit 1; }
echo "▸ 本次打包 VersionName=$VNAME  VersionCode=$VCODE"

# ── 0. 应用图标 ─────────────────────────────────────────────────────────────
# 每次打包都从唯一图标源重新生成各密度 launcher 图标（幂等：源不变则产物一致）。
ICON_SRC="$ROOT/public/app-icons/app-icon-1024.png"
if [[ -f "$ICON_SRC" ]] && command -v swift >/dev/null 2>&1; then
  echo "▸ [0/3] 生成应用图标（源：public/app-icons/app-icon-1024.png）…"
  swift "$ROOT/tools/make-android-icons.swift" "$ICON_SRC" "$ROOT/android/app/src/main/res" >/dev/null
else
  echo "⚠️  跳过图标生成（缺图标源或 swift），沿用现有 android 内图标。源应在 $ICON_SRC"
fi

# ── 1. Web 构建 ─────────────────────────────────────────────────────────────
if [[ $DO_WEB -eq 1 ]]; then
  echo "▸ [1/3] 构建 Web（npm run build）…"
  npm run build
else
  echo "▸ [1/3] 跳过 Web 构建，沿用现有 dist/"
fi

# ── 2. 同步到原生工程 ───────────────────────────────────────────────────────
echo "▸ [2/3] 同步 Web 资源到 Android（cap sync）…"
npx cap sync android

# ── 3. Gradle 打包 ──────────────────────────────────────────────────────────
# --init-script 引入阿里云镜像，绕开被阻断的 dl.google.com
INIT_GRADLE="$ROOT/android/gradle-mirror.init.gradle"
echo "▸ [3/3] Gradle 打 Release APK（经国内镜像）…"
( cd android && ./gradlew --no-daemon --init-script "$INIT_GRADLE" clean assembleRelease )

OUT=dist-apk
mkdir -p "$OUT"
SRC_APK="android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$SRC_APK" ]] || SRC_APK="android/app/build/outputs/apk/release/app-release-unsigned.apk"
[[ -f "$SRC_APK" ]] || { echo "❌ 未找到 APK 产物"; exit 1; }
# 加构建时间戳让文件名唯一 → 每次打包都保留旧包，绝不覆盖
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST_APK="$OUT/二十五时便利屋-v${VNAME}-${VCODE}-${STAMP}.apk"
cp "$SRC_APK" "$DEST_APK"

if [[ $DO_AAB -eq 1 ]]; then
  echo "▸ 额外打 AAB…"
  ( cd android && ./gradlew --no-daemon --init-script "$INIT_GRADLE" bundleRelease )
  cp android/app/build/outputs/bundle/release/app-release.aab "$OUT/二十五时便利屋-v${VNAME}-${VCODE}-${STAMP}.aab"
fi

echo ""
echo "✅ 打包完成（旧包已保留，未覆盖）"
echo "   本次 APK：$DEST_APK"
echo "   包名：com.ershiwushi.bianliwu  VersionName=$VNAME  VersionCode=$VCODE  构建时间=$STAMP"
echo "   大小：$(du -h "$DEST_APK" | cut -f1)"
echo "   → 上传 TapTap「官网包」即可（架构无关，兼容 64/32 位）"
echo ""
echo "   dist-apk/ 历史包（按时间，最新在最后）："
ls -1tr "$OUT"/*.apk 2>/dev/null | sed 's#^#     #'
