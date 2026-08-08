#!/bin/zsh
set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
WEB_DIR="$PROJECT_DIR/web"
PORT="${AI_CHARGING_STATION_PORT:-5173}"
HOST="${AI_CHARGING_STATION_HOST:-localhost}"
URL="http://${HOST}:${PORT}"
HEALTH_URL="${URL}/data/latest.json"
LOG_FILE="$PROJECT_DIR/logs/web-desktop-launcher.log"
PID_FILE="$PROJECT_DIR/.web.pid"

say() {
  print -r -- "$1"
}

if [[ ! -d "$WEB_DIR" ]]; then
  say "找不到前端目录：$WEB_DIR"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  say "找不到 npm。请先确认 Node.js 已安装并在 PATH 中。"
  exit 1
fi

mkdir -p "$PROJECT_DIR/logs"

if /usr/bin/curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
  say "AI充电站前端已经在运行：$URL"
else
  say "正在启动 AI充电站前端..."
  cd "$WEB_DIR" || exit 1
  nohup npm run dev -- --host "$HOST" --port "$PORT" --strictPort >> "$LOG_FILE" 2>&1 &
  pid=$!
  print -r -- "$pid" > "$PID_FILE"

  for _ in {1..45}; do
    if /usr/bin/curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
      say "前端已启动：$URL"
      break
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      say "前端启动失败。日志：$LOG_FILE"
      tail -40 "$LOG_FILE"
      exit 1
    fi

    sleep 1
  done

  if ! /usr/bin/curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    say "前端还没有就绪。日志：$LOG_FILE"
    tail -40 "$LOG_FILE"
    exit 1
  fi
fi

/usr/bin/open "$URL"
say "已打开：$URL"
say "日志：$LOG_FILE"
