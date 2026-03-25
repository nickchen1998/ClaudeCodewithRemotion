# Claude Code with Remotion Auto-Edit

AI 驅動的短影音自動剪輯工作流。使用 Gemini 分析毛片、OpenAI 產生剪輯腳本、Remotion 自動合成影片。

透過 [Claude Code](https://claude.com/claude-code) 內建 Skill 一鍵完成從素材分析到影片輸出的全流程。

## 適用情境

本流程適合**已經錄製好影片素材**，需要快速剪輯成短影音的使用者。流程中不會主動生成任何影片或圖片素材，所有畫面皆來自你提供的毛片。

**適合：**
- 旅遊 Vlog — 拍了一堆景點素材，想快速剪成攻略短影音
- 活動紀錄 — 已有活動現場影片，需要整理成精華片段
- 產品開箱 — 拍好了開箱過程，想自動配上字幕和轉場
- 日常紀錄 — 手機隨手拍的生活片段，想組合成有結構的短影音

**不適合：**
- 需要從零生成影片素材（AI 生成影片、動畫等）
- 需要複雜的特效、綠幕合成、多軌音訊混音
- 長影片剪輯（本流程針對 30-60 秒短影音優化）

## 工作流程

```
毛片放入 public/ → Gemini 分析影片 → OpenAI 產生腳本 → 人工審稿 → Remotion 合成 → 渲染輸出 → 社群文案
```

## 快速開始

### 1. 前置準備

確認你的環境已安裝以下工具：

- [Node.js](https://nodejs.org/)（建議 v20+）
- [FFmpeg](https://ffmpeg.org/)（`brew install ffmpeg`）
- [Claude Code](https://claude.com/claude-code)

### 2. Clone & 安裝

```bash
git clone git@github.com:nickchen1998/ClaudeCodewithRemotion.git
cd ClaudeCodewithRemotion
npm install
```

### 3. 設定環境變數

複製 `.env.example` 並填入你的 API key：

```bash
cp .env.example .env
```

需要填入的 key：

| 變數 | 說明 |
|------|------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) 取得 |
| `GEMINI_MODEL` | 建議使用 `gemini-3-flash-preview` |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/) 取得 |
| `OPENAI_MODEL` | 依你的帳號權限選擇可用模型 |

### 4. 放入毛片素材

在 `public/` 底下以**英文 kebab-case** 建立專案子資料夾，將影片放入：

```
public/
├── meiji-shrine/          # 專案 A 的毛片
│   ├── IMG_8007.MOV
│   └── IMG_8008.MOV
├── asakusa-temple/        # 專案 B 的毛片
│   └── clip01.mp4
└── ...
```

> **注意**：
> - 影片檔案不會被 commit 到 Git（已在 `.gitignore` 中排除），請自行管理素材
> - 資料夾名稱請使用英文，避免中文路徑造成跨平台相容性問題

### 5. 啟動 Claude Code 開始剪輯

在專案目錄下啟動 Claude Code，輸入：

```
/remotion-auto-edit
```

或用自然語言：

```
幫我剪一支短影音
```

Claude 會自動引導你完成整個流程。

## Claude Code Skill 執行流程

本專案內建 Claude Code Skill（`.claude/skills/remotion-auto-edit/`），觸發後會自動依序執行：

| Step | 階段 | 說明 |
|------|------|------|
| Pre-flight | 環境檢查 | 自動確認 Remotion、npm 套件、`.env`、FFmpeg 是否就緒，缺少的會自動安裝或提示 |
| 0 | 蒐集資訊 | 詢問專案名稱、剪輯方向、確認素材 |
| 1 | 驗證素材 | 用 `ffprobe` 取得每支影片的實際時長 |
| 2 | Gemini 分析 | 逐支影片上傳到 Gemini，分析畫面內容與時間軸 |
| 3 | OpenAI 腳本 | 根據分析結果與剪輯方向，產生結構化剪輯腳本 |
| 4 | 時長驗證 | 確認每段時長不超過素材長度（避免凍結幀） |
| 5 | 使用者審稿 | 顯示腳本摘要表格，可調整字幕、順序、風格 |
| 6 | Remotion 合成 | 自動生成 composition 元件與轉場效果 |
| 7 | 渲染輸出 + 社群文案 | 輸出 MP4，同時產生 Instagram Reels 標題、描述、Hashtag（最多 5 個），一次告知使用者 |
| 8 | 輸出審查 | 檢查凍結幀、黑畫面、字幕、轉場等問題 |

## 剪輯紀錄

每次執行完整流程後，會在 `logs/` 目錄下自動產生一份紀錄檔：

```
logs/2026-03-25-明治神宮參拜.md
```

紀錄檔包含以下內容，方便日後回顧或重新調整：

| 區塊 | 內容 |
|------|------|
| **基本資訊** | 建立時間、使用的 Gemini / OpenAI 模型版本、剪輯方向 |
| **Gemini 影片分析** | 每支毛片的逐秒畫面分析結果（含剪輯建議） |
| **OpenAI 剪輯腳本** | 完整的原始腳本（片段、時長、字幕、轉場設定） |
| **結構化 JSON** | 解析後的片段摘要表格 + 完整 JSON 資料 |
| **Remotion 剪輯設定** | 解析度、幀數、手動調整紀錄（如修改字幕、樣式變更） |
| **Instagram 文案** | 標題、描述、Hashtag |

## 專案結構

```
ClaudeCodewithRemotion/
├── .claude/skills/remotion-auto-edit/   # Claude Code Skill
│   └── SKILL.md
├── public/                              # 放置影片素材（依專案建立子資料夾）
│   └── {project-folder}/               # 英文 kebab-case 命名
├── scripts/
│   ├── pipeline.mjs                     # AI 分析 + 腳本生成 pipeline
│   └── output/                          # Pipeline 輸出（JSON、分析結果）
├── src/
│   ├── Root.tsx                          # Remotion 入口
│   ├── VideoScene.tsx                    # 影片場景元件（通用）
│   ├── TextOverlay.tsx                   # 字幕覆蓋元件（通用）
│   ├── InfoCard.tsx                      # 資訊卡元件（通用）
│   └── compositions/                     # AI 自動生成的 composition（.gitignore 排除）
├── out/                                  # 渲染輸出的 MP4
├── logs/                                  # 每次剪輯的完整紀錄
│   └── {YYYY-MM-DD}-{專案名稱}.md
└── .env.example                          # 環境變數範本
```

## 注意事項

| 問題 | 原因 | 解法 |
|------|------|------|
| 轉場前畫面凍結 | 片段時長超過素材實際長度 | Skill 會自動用 `ffprobe` 驗證並調整 |
| 影片結尾黑畫面 | Composition 時長未扣除轉場重疊 | Skill 會自動計算正確幀數 |
| 轉場效果無效 | TransitionSeries 不支援 React.Fragment | 已使用 flat array 實作 |
| Studio 預覽卡頓 | 瀏覽器同時解碼多段影片 | 正常現象，渲染輸出不受影響 |
| OpenAI 產生不存在的檔名 | 模型幻覺 | Skill 會自動驗證檔名是否存在 |

## API 用量與費用估算

本工作流涉及三個 AI 服務，費用結構不同：

### 外部 API（使用你自己的 API key）

| 服務 | 用途 | 單次剪輯估算消耗 | 估算費用 |
|------|------|-----------------|---------|
| **Google Gemini** | 影片上傳 + 內容分析 | 8 支影片 × 每支約 3-6 秒 ≈ 影片總量約 30 秒 | 見下方詳細估算 |
| **OpenAI** | 剪輯腳本生成 | 約 3,000-5,000 tokens（input + output） | < $0.01 |

#### Gemini 費用估算

以 8 支短影片（總長約 30 秒）為例：

| 模型 | Input（影片） | Output（分析文字） | 單次估算費用 | 備註 |
|------|-------------|-------------------|------------|------|
| Gemini 2.5 Flash（免費方案） | 免費 | 免費 | **$0** | 有每日請求數限制 |
| Gemini 2.5 Flash（付費方案） | $0.30 / 1M tokens | $2.50 / 1M tokens | **~$0.01 - $0.05** | 影片約消耗數萬 tokens |

> **提示**：Gemini 免費方案有每日額度限制，適合低頻使用。若頻繁剪片建議使用付費方案，單次費用仍非常低。

#### OpenAI 費用估算

| 模型 | Input | Output | 單次估算費用 |
|------|-------|--------|------------|
| GPT-4o-mini | $0.15 / 1M tokens | $0.60 / 1M tokens | **< $0.01** |
| GPT-4o | $2.50 / 1M tokens | $10.00 / 1M tokens | **~$0.01 - $0.03** |

> **結論**：外部 API 單次剪輯的總費用約在 **$0.01 ~ $0.10** 之間，成本極低。

### Claude Code（訂閱制，不按 token 計費）

Claude Code 在本工作流中負責：程式碼生成、檔案操作、指令執行、互動審稿、社群文案撰寫。

| 方案 | 月費 | 適合情境 |
|------|------|---------|
| **Pro** | $20/月 | 偶爾剪片（每週 1-2 支），每支影片 1-2 輪調整即可定稿 |
| **Max** | $100/月 | 頻繁剪片或每支影片需要多輪來回調整（改字幕、重排順序、調轉場、反覆渲染預覽） |

> **建議**：如果是一般使用加上偶爾剪片，Pro 方案足夠。若將此作為常態工作流（每天剪片、大量互動調整），建議使用 Max 以避免撞到用量限制。

## 技術棧

- [Remotion](https://remotion.dev/) — React 影片框架
- [Google Gemini API](https://ai.google.dev/) — 影片內容分析
- [OpenAI API](https://platform.openai.com/) — 剪輯腳本生成
- [Claude Code](https://claude.com/claude-code) — AI 工作流自動化
