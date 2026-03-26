---
name: remotion-auto-edit
description: AI-powered short video auto-editing workflow. Analyzes raw footage with Gemini, generates editing script with OpenAI, builds Remotion composition, and renders output.
metadata:
  tags: remotion, video, editing, gemini, openai, short-form, automation
---

## When to use

Use this skill when the user wants to create a short-form video (Reels/TikTok/Shorts) from raw footage using the AI auto-editing pipeline. Trigger keywords: "edit video", "create short", "auto edit", "short video", "remotion edit", "剪輯".

## Overview

This is a complete AI-powered video editing workflow:

```
[Raw Footage] → [素材確認] → [使用者標註重點] → [Gemini Analyze] → [討論主題與方向] → [OpenAI Script] → [使用者確認腳本] → [Remotion Compose] → [Render]
```

## Full Workflow

Follow these steps **in order**. Each step has specific notes and checkpoints.

---

### Pre-flight: Environment Check

**This step runs automatically every time the skill is triggered.** Run all checks before proceeding. If any check fails, fix it before moving on.

```bash
# 1. Check if this is a Remotion project (package.json exists with remotion deps)
cat package.json | grep -q '"remotion"' && echo "✅ Remotion project detected" || echo "❌ Not a Remotion project"

# 2. Check required npm packages
for pkg in "@remotion/cli" "@remotion/transitions" "@remotion/media" "@google/generative-ai" "openai" "dotenv"; do
  node -e "require('$pkg')" 2>/dev/null && echo "✅ $pkg" || echo "❌ $pkg missing"
done

# 3. Check .env file exists and has required keys
if [ -f .env ] || [ -f ../.env ]; then
  echo "✅ .env file found"
  grep -q "GEMINI_API_KEY" .env 2>/dev/null || grep -q "GEMINI_API_KEY" ../.env 2>/dev/null && echo "✅ GEMINI_API_KEY set" || echo "❌ GEMINI_API_KEY missing"
  grep -q "GEMINI_MODEL" .env 2>/dev/null || grep -q "GEMINI_MODEL" ../.env 2>/dev/null && echo "✅ GEMINI_MODEL set" || echo "❌ GEMINI_MODEL missing"
  grep -q "OPENAI_API_KEY" .env 2>/dev/null || grep -q "OPENAI_API_KEY" ../.env 2>/dev/null && echo "✅ OPENAI_API_KEY set" || echo "❌ OPENAI_API_KEY missing"
  grep -q "OPENAI_MODEL" .env 2>/dev/null || grep -q "OPENAI_MODEL" ../.env 2>/dev/null && echo "✅ OPENAI_MODEL set" || echo "❌ OPENAI_MODEL missing"
else
  echo "❌ .env file not found"
fi

# 4. Check ffprobe available
which ffprobe >/dev/null 2>&1 && echo "✅ ffprobe available" || echo "❌ ffprobe not found (install FFmpeg)"

# 5. Check public/ directory exists
[ -d public ] && echo "✅ public/ directory exists" || echo "❌ public/ directory missing"

# 6. Check tsconfig has resolveJsonModule
grep -q "resolveJsonModule" tsconfig.json 2>/dev/null && echo "✅ resolveJsonModule enabled" || echo "⚠️ resolveJsonModule not set in tsconfig.json"

# 7. Check scripts directory structure
[ -d scripts/output ] && echo "✅ scripts/output/ exists" || echo "⚠️ scripts/output/ missing (will be created)"
```

**Auto-fix behavior:**
- Missing npm packages → Run `npm install <packages>` automatically
- Missing `scripts/output/` → Create it automatically
- Missing `resolveJsonModule` → Add to `tsconfig.json` automatically
- Missing `.env` → Prompt user to create one with the following template:

```env
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3-flash-preview"

OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-5.4-nano"
```

- Missing `ffprobe` → Tell user to install FFmpeg (`brew install ffmpeg` on macOS)
- Not a Remotion project → Ask user if they want to initialize one

**Only proceed to Step 1 after all checks pass (✅).**

---

### Step 1: Verify Source Material & User Annotation

Before calling any AI API:

```bash
# Check videos exist in public/{project-folder}/
ls public/{project-folder}/*.MOV public/{project-folder}/*.mp4

# Get actual duration of each video (CRITICAL for avoiding freeze frames)
for f in public/{project-folder}/*.MOV public/{project-folder}/*.mp4; do
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null)
  echo "$f: ${duration}s"
done
```

**列出所有檔案後，詢問使用者：**

以表格形式列出所有素材檔案（檔名 + 時長），然後問使用者：

> 「以上是所有的素材檔案，請問有沒有哪幾支影片你希望 AI 分析時特別著重提取的部分？例如某支影片的特定秒數、特定畫面等。如果沒有的話，回覆『沒有』即可，我會全部按預設方式分析。」

- 如果使用者有標註 → 記錄下來，在 Step 2 的 Gemini prompt 中加入對應的著重指示
- 如果使用者回覆「沒有」→ 直接進入 Step 2

> **Important**: 素材資料夾請使用英文 kebab-case 命名，避免中文路徑造成跨平台相容性問題。

**Checkpoint:**
- [ ] All video files are present in `public/{project-folder}/`
- [ ] Recorded actual duration of each source file (will need this in Step 5)
- [ ] User annotation collected (or confirmed none needed)

---

### Step 2: Gemini Video Analysis

Run the pipeline script or call Gemini API directly to analyze each video.

**Prompt template for Gemini:**
```
請使用繁體中文替我分析這個影片的內容，請使用秒為單位分析每個區間的畫面，方便後續我進行影片剪輯，產出的說明文字請大約落在 300 字以內。
```

如果使用者在 Step 1 有標註特定檔案的著重內容，在該檔案的 prompt 中追加：
```
請特別注意並詳細描述以下部分：[使用者標註的內容]
```

**Prompt tuning notes:**
- If videos contain text/signs, add: `請特別注意畫面中的文字內容並翻譯`
- If videos have people, add: `請描述人物的動作與互動`
- If you need more detail, increase word limit to 500
- If analysis is too verbose, reduce to 200

**Checkpoint:**
- [ ] All videos analyzed successfully (check for FAILED status)
- [ ] Analysis results saved to `scripts/output/analyses.json`
- [ ] Review analyses make sense (Gemini sometimes hallucinates video content)

---

### Step 3: Discuss Editing Direction with User (Interactive)

分析完成後，**先根據分析結果主動向使用者提案**，再確認剪輯方向。

**流程：**

1. 根據 Gemini 分析結果，整理出：
   - **建議的影片主題**（1-2 個方向）
   - **建議的敘事流程**（哪支影片先、哪支後，大致的故事線）
   - **預估總時長**

2. 將以上建議呈現給使用者，同時詢問：
   > 「以上是我根據分析結果建議的主題和流程。請問你想剪輯成什麼樣的影片？有沒有特定的主題或敘事方式？如果覺得我的建議 OK，直接回覆『OK』就可以開始下一步了。」

3. **等待使用者確認：**
   - 使用者回覆 OK / 接受 → 進入 Step 4
   - 使用者有不同想法 → 繼續討論，調整主題和流程方向，直到使用者確認為止

**重點：這一步不能跳過，必須取得使用者明確同意才能進入腳本生成。**

---

### Step 4: OpenAI Script Generation

Send all analyses + confirmed editing direction to OpenAI to generate the structured editing script.

**System prompt key points:**
- Role: Senior short-form video director
- Must use ONLY filenames that exist in the input data
- Total duration should match the target (e.g., 30-60 seconds)
- Output format must be strictly followed
- 融入使用者在 Step 3 確認的主題和敘事方向

**Output format per segment:**
```
片段 [N]：
- 總時長：[start] ~ [end]
- 檔案名稱：[filename.MOV]
- 擷取位置：[trim start] ~ [trim end]
- 內容字幕：[Chinese subtitle]
- 英文字幕：[English subtitle]
- 畫面描述：[Visual description]
- 字幕樣式：[default / highlight / info]
- 轉場效果：[fade / slide-right / slide-bottom / none]
```

**Prompt tuning notes:**
- GPT produces more stable/structured scripts; Gemini produces more creative but sometimes inconsistent output
- If the script uses filenames that don't exist, re-run with stronger constraint emphasis
- If pacing feels off, specify exact duration constraints per segment

**Checkpoint:**
- [ ] All filenames in the script exist in `public/`
- [ ] No fabricated filenames
- [ ] Script saved to `scripts/output/script-raw.txt` and `scripts/output/script.json`

---

### Step 5: Duration Validation (CRITICAL)

**This is the most common source of bugs.** Compare script segment durations against actual source video durations.

```
Rule: segment.durationSeconds MUST be <= source video actual duration
      (minus trimStart if specified)
```

If a segment is longer than its source:
- **The video will freeze on the last frame**, causing visible stutter before transitions
- Fix by reducing `durationSeconds` in `script.json`

Also calculate the correct total frame count for the Composition:

```
actualFrames = sum(all segment frames) - (number of non-"none" transitions × TRANSITION_FRAMES)
```

**Checkpoint:**
- [ ] Every segment duration ≤ source video duration
- [ ] Composition `durationInFrames` accounts for transition overlaps
- [ ] No segment will cause a freeze frame

---

### Step 6: Review Script with User (Interactive)

腳本生成完畢後，展示給使用者確認：

1. 以表格呈現每個片段的摘要（檔名、時長、字幕、風格、轉場）
2. 詢問使用者：
   > 「以上是生成的剪輯腳本，請確認字幕內容、順序、轉場等是否需要調整。沒問題的話回覆『OK』，我就開始進行剪輯。」

3. **等待使用者確認：**
   - 使用者回覆 OK → 進入 Step 7
   - 使用者有調整需求 → 討論並修改腳本，直到使用者確認為止

**Common adjustments:**
- Subtitle wording (AI-generated text may not match user's intent)
- Segment ordering (AI may not understand the narrative flow)
- Removing/adding segments
- Changing transition types

---

### Step 7: Generate Remotion Composition & Render

Create/update the composition file in **`src/compositions/`** (NOT `src/` root).

**File structure rules:**
- Composition 檔案：`src/compositions/[Name].tsx`（被 .gitignore 排除，不會推上 git）
- 通用元件（VideoScene、TextOverlay、InfoCard）在 `src/` 根目錄
- Import 路徑：`import { VideoScene } from "../VideoScene"` （注意是 `../`）
- Import script.json：`import scriptData from "../../scripts/output/script.json"`
- 更新 `src/Root.tsx`：`import { [Name] } from "./compositions/[Name]"`

**Key implementation notes:**
- Use `TransitionSeries` with **flat array children** (NOT React.Fragment - it breaks transition parsing)
- Set `muted` on all `<Video>` components (unless user wants audio)
- Use `staticFile()` for video sources in `public/`
- Import script.json with `resolveJsonModule: true` in tsconfig

**Subtitle style defaults:**
- `default`: `rgba(0,0,0, 0.6)` - Standard
- `info`: `rgba(0,0,0, 0.7)` - Slightly darker
- `highlight`: `rgba(0,0,0, 0.75)` - Emphasis (NOT red)

**Render:**

```bash
npx remotion render [CompositionId] out/[output-name].mp4
```

After render completes,告知使用者：
1. 輸出檔案路徑、大小、時長
2. 提醒使用者去查看輸出的影片檔案

同時將輸出資訊寫入 `logs/` 目錄下的紀錄 `.md` 檔。

---

### Step 8: Post-Render Review Checklist

Ask the user to review the rendered video and check:

- [ ] No freeze frames / stuttering between segments
- [ ] No black frames at the beginning or end
- [ ] Subtitles are readable and correctly timed
- [ ] Transitions are smooth
- [ ] Video orientation is correct (no rotated clips)
- [ ] Overall pacing feels right

If issues found, go back to the relevant step and fix.

---

### Optional: Social Media Copy

如果使用者主動要求產生社群文案，才進行此步驟。

**Instagram 文案格式：**
- 標題控制在 30 字以內（簡短有吸引力，含 1-2 個 emoji）
- 描述以條列式為主，方便閱讀
- Hashtag 固定 5 個，選擇與主題最相關的
- 語氣輕鬆親切，適合 Instagram 受眾

將文案資訊一併寫入 `logs/` 的紀錄檔與 `scripts/output/script.json`。

---

## Pipeline Script

The automated pipeline script is at `scripts/pipeline.mjs`:

```bash
node scripts/pipeline.mjs \
  --name "Project Name" \
  --project "project-folder" \
  --direction "Editing direction description" \
  --files "FILE1,FILE2,..."  # Optional filter
```

- `--project`: 對應 `public/` 下的子資料夾名稱（英文 kebab-case）
- pipeline 會自動在 script.json 的 filename 加上子資料夾路徑，確保 `staticFile()` 能正確找到檔案

This handles Steps 2 & 4 automatically and outputs:
- `scripts/output/analyses.json` - Gemini analysis results
- `scripts/output/script-raw.txt` - Raw OpenAI script
- `scripts/output/script.json` - Structured JSON for Remotion
- `logs/{YYYY-MM-DD}-{project-name}.md` - Full process log

---

## Environment Setup

Required in `.env` at project root:
```
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-3-flash-preview"
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-5.4-nano"
```

Required npm packages: `@google/generative-ai`, `openai`, `dotenv`

Required tsconfig: `"resolveJsonModule": true`

---

## Common Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| Freeze before transitions | Segment duration > source video length | Run ffprobe, cap durations |
| Black frames at end | Composition duration doesn't account for transition overlaps | Subtract (transition_count × TRANSITION_FRAMES) |
| Transitions not working | Using React.Fragment in TransitionSeries | Use flat array for children |
| Red subtitle background | `highlight` style uses red | Change to dark semi-transparent |
| Video not playing in Studio | MOV codec not supported in Chrome | Renders fine with Remotion CLI, preview issue only |
| Wrong filenames in script | OpenAI hallucinated filenames | Re-run with stricter prompt, verify against actual files |
