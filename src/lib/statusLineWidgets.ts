// Catalog of status-line widgets the builder can compose.
//
// Each widget contributes one "part" — a small shell snippet that emits a
// single value to stdout. The generator joins all enabled parts with the
// configured separator into a single ~/.claude/statusline.sh script that
// Claude Code reads at the bottom of every prompt.
//
// stdin contract documented at https://code.claude.com/docs/en/statusline.

export type WidgetCategory = "session" | "context" | "cost" | "quota" | "project" | "git" | "system";

export type Widget = {
  id: string;
  label: string;
  description: string;
  category: WidgetCategory;
  // Pretty preview shown in the UI's mock terminal. Use realistic example values.
  preview: string;
  // Shell snippet. Has access to: $INPUT (the raw stdin JSON), $SEP (separator), jq.
  // Must `echo` exactly one line of output. If the value is empty, echo nothing
  // and the generator will skip the part.
  shell: string;
  // External tools the snippet relies on. UI surfaces a "needs X installed" hint.
  deps?: ("jq" | "git" | "ccusage" | "pmset")[];
  // Some widgets need refreshInterval set in settings.json (e.g. clock, battery)
  // — these wouldn't update otherwise between Claude responses.
  needsRefresh?: boolean;
};

export const widgets: Widget[] = [
  // ───────── Session ─────────
  {
    id: "model",
    label: "Model",
    description: "Claude model name with type emoji (🧠 Opus / ⚡ Sonnet / 🪶 Haiku).",
    category: "session",
    preview: "⚡ Sonnet 4.6",
    deps: ["jq"],
    shell: `M=$(printf '%s' "$INPUT" | jq -r '.model.display_name // ""')
case "$M" in
  *Opus*) echo "🧠 $M" ;;
  *Sonnet*) echo "⚡ $M" ;;
  *Haiku*) echo "🪶 $M" ;;
  *) [ -n "$M" ] && echo "🤖 $M" ;;
esac`,
  },
  {
    id: "version",
    label: "Claude Code version",
    description: "The CLI version, e.g. v2.1.90.",
    category: "session",
    preview: "📟 v2.1.90",
    deps: ["jq"],
    shell: `V=$(printf '%s' "$INPUT" | jq -r '.version // ""')
[ -n "$V" ] && echo "📟 v$V"`,
  },
  {
    id: "effort",
    label: "Reasoning effort",
    description: "Current effort level (low / medium / high / xhigh / max).",
    category: "session",
    preview: "effort: high",
    deps: ["jq"],
    shell: `E=$(printf '%s' "$INPUT" | jq -r '.effort.level // ""')
[ -n "$E" ] && echo "effort: $E"`,
  },
  {
    id: "thinking",
    label: "Extended thinking",
    description: "Indicator when extended thinking is enabled.",
    category: "session",
    preview: "🧠 thinking",
    deps: ["jq"],
    shell: `T=$(printf '%s' "$INPUT" | jq -r '.thinking.enabled // false')
[ "$T" = "true" ] && echo "🧠 thinking"`,
  },
  {
    id: "output-style",
    label: "Output style",
    description: "Active output style (default / terse / explanatory / …).",
    category: "session",
    preview: "🎨 terse",
    deps: ["jq"],
    shell: `S=$(printf '%s' "$INPUT" | jq -r '.output_style.name // ""')
[ -n "$S" ] && echo "🎨 $S"`,
  },

  // ───────── Context ─────────
  {
    id: "context-percent",
    label: "Context %",
    description: "How much of the context window is used.",
    category: "context",
    preview: "ctx 42%",
    deps: ["jq"],
    shell: `P=$(printf '%s' "$INPUT" | jq -r '.context_window.used_percentage // 0' | awk '{printf "%d", $1}')
echo "ctx \${P}%"`,
  },
  {
    id: "context-bar",
    label: "Context bar",
    description: "Visual progress bar of context usage.",
    category: "context",
    preview: "ctx ▓▓▓▓░░░░░░ 42%",
    deps: ["jq"],
    shell: `P=$(printf '%s' "$INPUT" | jq -r '.context_window.used_percentage // 0' | awk '{printf "%d", $1}')
FILLED=$((P/10)); EMPTY=$((10-FILLED))
BAR=$(printf '%*s' "$FILLED" | tr ' ' '▓')$(printf '%*s' "$EMPTY" | tr ' ' '░')
echo "ctx $BAR \${P}%"`,
  },
  {
    id: "context-tokens",
    label: "Context tokens",
    description: "Raw token count vs. window size (e.g. 15.5K / 200K).",
    category: "context",
    preview: "15.5K / 200K",
    deps: ["jq"],
    shell: `read U W < <(printf '%s' "$INPUT" | jq -r '"\\(.context_window.total_input_tokens // 0) \\(.context_window.context_window_size // 200000)"')
fmt() { awk -v n="$1" 'BEGIN{ if(n>=1000000) printf "%.1fM",n/1000000; else if(n>=1000) printf "%.1fK",n/1000; else printf "%d",n }'; }
echo "$(fmt "$U") / $(fmt "$W")"`,
  },

  // ───────── Cost ─────────
  {
    id: "session-cost",
    label: "Session cost",
    description: "Cumulative cost since the session started (client-side estimate).",
    category: "cost",
    preview: "💰 $0.23",
    deps: ["jq"],
    shell: `C=$(printf '%s' "$INPUT" | jq -r '.cost.total_cost_usd // 0')
printf "💰 \\$%.2f" "$C"`,
  },
  {
    id: "session-duration",
    label: "Session duration",
    description: "Wall-clock time since session start.",
    category: "cost",
    preview: "⏱ 12m 30s",
    deps: ["jq"],
    shell: `MS=$(printf '%s' "$INPUT" | jq -r '.cost.total_duration_ms // 0')
S=$((MS/1000)); M=$((S/60)); R=$((S%60))
if [ $M -ge 60 ]; then H=$((M/60)); echo "⏱ \${H}h $((M%60))m"
elif [ $M -gt 0 ]; then echo "⏱ \${M}m \${R}s"
else echo "⏱ \${R}s"; fi`,
  },
  {
    id: "lines-changed",
    label: "Lines changed",
    description: "Lines added / removed during the session.",
    category: "cost",
    preview: "+156 -23",
    deps: ["jq"],
    shell: `read A R < <(printf '%s' "$INPUT" | jq -r '"\\(.cost.total_lines_added // 0) \\(.cost.total_lines_removed // 0)"')
echo "+$A -$R"`,
  },
  {
    id: "daily-cost",
    label: "Daily cost (ccusage)",
    description: "Total cost across all sessions today. Needs `ccusage` installed.",
    category: "cost",
    preview: "$1.23 today",
    deps: ["ccusage"],
    shell: `D=$(ccusage daily --json 2>/dev/null | jq -r '.totals.totalCost // 0' 2>/dev/null)
[ -n "$D" ] && [ "$D" != "null" ] && printf "\\$%.2f today" "$D"`,
  },
  {
    id: "block-cost",
    label: "5h block cost (ccusage)",
    description: "Cost of the current 5-hour billing block + time remaining.",
    category: "cost",
    preview: "$0.45 block (2h 45m left)",
    deps: ["ccusage", "jq"],
    shell: `B=$(ccusage blocks --active --json 2>/dev/null)
[ -z "$B" ] && exit 0
read C E < <(printf '%s' "$B" | jq -r '"\\(.blocks[0].costUSD // 0) \\(.blocks[0].endTime // empty)"')
[ -z "$E" ] && exit 0
NOW=$(date +%s); END=$(date -d "$E" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "\${E%.*}" +%s 2>/dev/null)
[ -z "$END" ] && exit 0
LEFT=$((END-NOW)); H=$((LEFT/3600)); M=$(((LEFT%3600)/60))
printf "\\$%.2f block (\${H}h \${M}m left)" "$C"`,
  },
  {
    id: "burn-rate",
    label: "Burn rate (ccusage)",
    description: "$/hour spend rate for the active 5h block.",
    category: "cost",
    preview: "🔥 $0.12/hr",
    deps: ["ccusage", "jq"],
    shell: `B=$(ccusage blocks --active --json 2>/dev/null)
[ -z "$B" ] && exit 0
read C S < <(printf '%s' "$B" | jq -r '"\\(.blocks[0].costUSD // 0) \\(.blocks[0].startTime // empty)"')
[ -z "$S" ] && exit 0
NOW=$(date +%s); START=$(date -d "$S" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "\${S%.*}" +%s 2>/dev/null)
[ -z "$START" ] && exit 0
ELAPSED=$((NOW-START))
[ $ELAPSED -le 0 ] && exit 0
RATE=$(awk -v c="$C" -v e="$ELAPSED" 'BEGIN{printf "%.2f", (c/e)*3600}')
echo "🔥 \\$\${RATE}/hr"`,
  },

  // ───────── Quota (rate limits) ─────────
  {
    id: "5h-bar",
    label: "5-hour quota bar",
    description: "Bar of the 5-hour rate limit + reset time. Pro/Max accounts only.",
    category: "quota",
    preview: "5h ▓▓░░░░░░░░ 23% → 14:30",
    deps: ["jq"],
    shell: `read P R < <(printf '%s' "$INPUT" | jq -r '"\\(.rate_limits.five_hour.used_percentage // -1) \\(.rate_limits.five_hour.resets_at // empty)"')
[ "$P" = "-1" ] && exit 0
P=$(printf '%.0f' "$P")
FILLED=$((P/10)); EMPTY=$((10-FILLED))
BAR=$(printf '%*s' "$FILLED" | tr ' ' '▓')$(printf '%*s' "$EMPTY" | tr ' ' '░')
RT=""
[ -n "$R" ] && RT=" → $(date -r "$R" +%H:%M 2>/dev/null || date -d "@$R" +%H:%M 2>/dev/null)"
echo "5h $BAR \${P}%\${RT}"`,
  },
  {
    id: "7d-bar",
    label: "7-day quota bar",
    description: "Bar of the weekly rate limit + reset time. Pro/Max accounts only.",
    category: "quota",
    preview: "7d ▓▓▓▓▓░░░░░ 51% → Mon",
    deps: ["jq"],
    shell: `read P R < <(printf '%s' "$INPUT" | jq -r '"\\(.rate_limits.seven_day.used_percentage // -1) \\(.rate_limits.seven_day.resets_at // empty)"')
[ "$P" = "-1" ] && exit 0
P=$(printf '%.0f' "$P")
FILLED=$((P/10)); EMPTY=$((10-FILLED))
BAR=$(printf '%*s' "$FILLED" | tr ' ' '▓')$(printf '%*s' "$EMPTY" | tr ' ' '░')
RT=""
[ -n "$R" ] && RT=" → $(date -r "$R" +%a 2>/dev/null || date -d "@$R" +%a 2>/dev/null)"
echo "7d $BAR \${P}%\${RT}"`,
  },

  // ───────── Project ─────────
  {
    id: "cwd",
    label: "Current directory",
    description: "Working directory basename, with ~ for home.",
    category: "project",
    preview: "📁 claude-config-manager",
    deps: ["jq"],
    shell: `D=$(printf '%s' "$INPUT" | jq -r '.workspace.current_dir // .cwd // ""')
[ -z "$D" ] && exit 0
SHORT=\${D/#$HOME/\\~}
echo "📁 \${SHORT##*/}"`,
  },
  {
    id: "cwd-full",
    label: "Full path",
    description: "Full current directory path, ~ for home.",
    category: "project",
    preview: "📁 ~/projects/claude-config-manager",
    deps: ["jq"],
    shell: `D=$(printf '%s' "$INPUT" | jq -r '.workspace.current_dir // .cwd // ""')
[ -z "$D" ] && exit 0
echo "📁 \${D/#$HOME/\\~}"`,
  },
  {
    id: "session-name",
    label: "Session name",
    description: "Custom session name set via --name or /rename.",
    category: "project",
    preview: "📌 launch-week",
    deps: ["jq"],
    shell: `N=$(printf '%s' "$INPUT" | jq -r '.session_name // ""')
[ -n "$N" ] && echo "📌 $N"`,
  },

  // ───────── Git ─────────
  {
    id: "git-branch",
    label: "Git branch",
    description: "Current branch (only inside a git repo).",
    category: "git",
    preview: "🌿 main",
    deps: ["git"],
    shell: `git rev-parse --git-dir >/dev/null 2>&1 || exit 0
B=$(git branch --show-current 2>/dev/null)
[ -n "$B" ] && echo "🌿 $B"`,
  },
  {
    id: "git-dirty",
    label: "Git clean/dirty",
    description: "● if there are uncommitted changes, ✓ if clean.",
    category: "git",
    preview: "●",
    deps: ["git"],
    shell: `git rev-parse --git-dir >/dev/null 2>&1 || exit 0
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then echo "✓"; else echo "●"; fi`,
  },
  {
    id: "git-ahead-behind",
    label: "Git ahead/behind",
    description: "↑N ↓N relative to upstream.",
    category: "git",
    preview: "↑2 ↓1",
    deps: ["git"],
    shell: `git rev-parse --git-dir >/dev/null 2>&1 || exit 0
COUNTS=$(git rev-list --left-right --count '@{u}...HEAD' 2>/dev/null) || exit 0
BEHIND=$(echo "$COUNTS" | awk '{print $1}')
AHEAD=$(echo "$COUNTS" | awk '{print $2}')
OUT=""
[ "$AHEAD" -gt 0 ] && OUT="↑$AHEAD"
[ "$BEHIND" -gt 0 ] && OUT="$OUT \${OUT:+}↓$BEHIND"
[ -n "$OUT" ] && echo "$OUT"`,
  },
  {
    id: "git-sha",
    label: "Git short SHA",
    description: "Short SHA of HEAD.",
    category: "git",
    preview: "a3f9b2c",
    deps: ["git"],
    shell: `git rev-parse --git-dir >/dev/null 2>&1 || exit 0
git rev-parse --short HEAD 2>/dev/null`,
  },

  // ───────── System ─────────
  {
    id: "time",
    label: "Clock",
    description: "Current local time HH:MM. Set refreshInterval to keep it live.",
    category: "system",
    preview: "🕒 14:32",
    needsRefresh: true,
    shell: `echo "🕒 $(date +%H:%M)"`,
  },
  {
    id: "hostname",
    label: "Hostname",
    description: "Short machine hostname.",
    category: "system",
    preview: "🖥 mbp",
    shell: `H=$(hostname -s 2>/dev/null || hostname 2>/dev/null)
[ -n "$H" ] && echo "🖥 $H"`,
  },
  {
    id: "battery",
    label: "Battery (mac/linux)",
    description: "% charge with charging indicator. Set refreshInterval for live updates.",
    category: "system",
    preview: "🔋 87%",
    needsRefresh: true,
    deps: ["pmset"],
    shell: `if command -v pmset >/dev/null 2>&1; then
  L=$(pmset -g batt 2>/dev/null | grep -Eo '[0-9]+%' | head -1)
  [ -n "$L" ] && echo "🔋 $L"
elif [ -r /sys/class/power_supply/BAT0/capacity ]; then
  echo "🔋 $(cat /sys/class/power_supply/BAT0/capacity)%"
fi`,
  },
];

export const widgetById = Object.fromEntries(widgets.map((w) => [w.id, w]));

export const categoryLabels: Record<WidgetCategory, { label: string; emoji: string }> = {
  session: { label: "Session", emoji: "🧠" },
  context: { label: "Context", emoji: "📊" },
  cost: { label: "Cost & duration", emoji: "💰" },
  quota: { label: "Rate limits", emoji: "⏱" },
  project: { label: "Project", emoji: "📁" },
  git: { label: "Git", emoji: "🌿" },
  system: { label: "System", emoji: "🖥" },
};
