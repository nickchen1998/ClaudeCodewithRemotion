/**
 * 短影音自動剪輯 Pipeline
 *
 * 用法：node scripts/pipeline.mjs --name "專案名稱" --direction "剪輯方向" [--files "IMG_8007,IMG_8008,..."]
 *
 * 流程：
 *   1. Gemini 分析影片
 *   2. OpenAI 產生剪輯腳本
 *   3. 解析為結構化 JSON
 *   4. 產生紀錄 .md 檔案於專案根目錄
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateRecommendations } from "./recommend.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── CLI Args ────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    parsed[key] = args[i + 1];
  }
  return parsed;
}

const cliArgs = parseArgs();
const PROJECT_NAME = cliArgs.name || "untitled";
const EDITING_DIRECTION = cliArgs.direction || "";
const PROJECT_FOLDER = cliArgs.project || "";
const FILE_FILTER = cliArgs.files
  ? cliArgs.files.split(",").map((f) => f.trim())
  : null;

// ── Config ──────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BASE_PUBLIC_DIR = path.resolve(__dirname, "../public");
const PUBLIC_DIR = PROJECT_FOLDER
  ? path.resolve(BASE_PUBLIC_DIR, PROJECT_FOLDER)
  : BASE_PUBLIC_DIR;
const OUTPUT_DIR = path.resolve(__dirname, "output");

// ── Markdown Logger ─────────────────────────────────
class PipelineLogger {
  constructor(projectName) {
    const date = new Date().toISOString().slice(0, 10);
    const LOGS_DIR = path.join(PROJECT_ROOT, "logs");
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    this.filename = `${date}-${projectName}.md`;
    this.filepath = path.join(LOGS_DIR, this.filename);
    this.lines = [];
  }

  add(text) {
    this.lines.push(text);
  }

  save() {
    fs.writeFileSync(this.filepath, this.lines.join("\n"), "utf-8");
  }
}

// ── Step 1: Gemini 分析影片 ─────────────────────────
async function analyzeVideos(logger) {
  const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let videoFiles = fs
    .readdirSync(PUBLIC_DIR)
    .filter((f) => /\.(mov|mp4)$/i.test(f))
    .sort();

  // 如果有指定檔案，只處理指定的
  if (FILE_FILTER) {
    videoFiles = videoFiles.filter((f) =>
      FILE_FILTER.some((filter) => f.includes(filter))
    );
  }

  console.log(`\n📹 找到 ${videoFiles.length} 支影片，開始上傳並分析...\n`);

  logger.add(`## Step 1：Gemini 影片分析`);
  logger.add(``);
  logger.add(`- 模型：\`${GEMINI_MODEL}\``);
  logger.add(`- 影片數量：${videoFiles.length}`);
  logger.add(`- 影片清單：${videoFiles.join(", ")}`);
  logger.add(``);

  const analyses = [];

  for (const filename of videoFiles) {
    const filePath = path.join(PUBLIC_DIR, filename);
    console.log(`⏳ 上傳 ${filename}...`);

    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType: filename.toLowerCase().endsWith(".mov")
        ? "video/quicktime"
        : "video/mp4",
      displayName: filename,
    });

    let file = uploadResult.file;
    while (file.state === "PROCESSING") {
      console.log(`   處理中...`);
      await new Promise((r) => setTimeout(r, 3000));
      file = await fileManager.getFile(file.name);
    }

    if (file.state === "FAILED") {
      console.error(`   ❌ ${filename} 處理失敗，跳過`);
      logger.add(`### ❌ ${filename}（處理失敗）`);
      logger.add(``);
      continue;
    }

    console.log(`   🔍 分析 ${filename}...`);

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      {
        text: `請使用繁體中文替我分析這個影片的內容，請使用秒為單位分析每個區間的畫面，方便後續我進行影片剪輯，產出的說明文字請大約落在 300 字以內。`,
      },
    ]);

    const analysis = result.response.text();
    console.log(`   ✅ ${filename} 分析完成\n`);

    analyses.push({ filename, analysis });

    // 寫入 log
    logger.add(`### ${filename}`);
    logger.add(``);
    logger.add(analysis);
    logger.add(``);
  }

  return analyses;
}

// ── Step 2: OpenAI 產生剪輯腳本 ─────────────────────
async function generateScript(analyses, logger) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const videoContents =
    analyses
      .map(
        (a) =>
          `==========\n檔案名稱：${a.filename}\n影片分析：${a.analysis}`
      )
      .join("\n==========\n") + "\n==========";

  console.log(`\n🤖 呼叫 OpenAI (${OPENAI_MODEL}) 產生剪輯腳本...\n`);

  const systemPrompt = `# Role
你是一位資深短影音導演與專業剪輯師，擅長透過流暢的敘事與精準的節奏規畫腳本。

# Task
請根據使用者提供的「影片內容資訊」與「參考文案」，規劃出一份具備邏輯性與吸引力的短影音剪輯腳本。

# Constraints
1. 語言：全程使用「繁體中文」回答。
2. 素材對齊：腳本中的「檔案名稱」必須嚴格對應輸入資料中存在的檔案，不可虛構。
3. 內容：確保腳本內容能完整表達「主要介紹內容」的核心價值。
4. 總時長：整支影片建議控制在 45-60 秒左右。
5. 格式：請嚴格依照下方指定的腳本範例格式輸出，不要提供多餘的開場白或結語。

# Input Data
- 主要介紹內容與參考文案：${EDITING_DIRECTION}

# Output Format Example
==========
片段 [數字]：
- 總時長：[起始秒數] ~ [結束秒數]
- 檔案名稱：[對應素材檔名.MOV]
- 擷取位置：[該素材的起始時間] ~ [該素材的結束時間]
- 內容字幕：[具備吸引力的繁體中文字幕內容]
- 英文字幕：[English subtitle]
- 畫面描述：[簡述此片段的畫面重點或剪輯建議]
- 字幕樣式：[default / highlight / info]
- 轉場效果：[fade / slide-right / slide-bottom / none]
==========`;

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `下面是我的影片內容分析，請你替我利用這些毛片內容產生出腳本：\n\n${videoContents}`,
      },
    ],
  });

  const scriptText = response.choices[0].message.content;

  // 寫入 log
  logger.add(`## Step 2：OpenAI 剪輯腳本`);
  logger.add(``);
  logger.add(`- 模型：\`${OPENAI_MODEL}\``);
  logger.add(``);
  logger.add("```");
  logger.add(scriptText);
  logger.add("```");
  logger.add(``);

  return scriptText;
}

// ── Step 3: 解析腳本為結構化 JSON ───────────────────
function parseScript(scriptText) {
  const segments = [];
  const blocks = scriptText.split(/片段\s*\d+[：:]/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const get = (label) => {
      const match = block.match(new RegExp(`${label}[：:]\\s*(.+)`));
      return match ? match[1].trim() : "";
    };

    const timeRange = get("總時長");
    const filename = get("檔案名稱");
    const trimRange = get("擷取位置");
    const textZh = get("內容字幕");
    const textEn = get("英文字幕");
    const description = get("畫面描述");
    const textStyle = get("字幕樣式") || "default";
    const transition = get("轉場效果") || "fade";

    if (!filename) continue;

    const parseTime = (str) => {
      const match = str.match(
        /(\d+(?:\.\d+)?)\s*(?:s|秒)?\s*~\s*(\d+(?:\.\d+)?)\s*(?:s|秒)?/
      );
      return match
        ? { start: parseFloat(match[1]), end: parseFloat(match[2]) }
        : null;
    };

    const totalTime = parseTime(timeRange);
    const trimTime = parseTime(trimRange);

    // 如果有 project folder，在 filename 前加上子資料夾路徑
    const cleanFilename = filename.replace(/[「」]/g, "");
    const fullPath = PROJECT_FOLDER
      ? `${PROJECT_FOLDER}/${cleanFilename}`
      : cleanFilename;

    segments.push({
      filename: fullPath,
      durationSeconds: totalTime ? totalTime.end - totalTime.start : 4,
      trimStart: trimTime ? trimTime.start : 0,
      trimEnd: trimTime ? trimTime.end : undefined,
      textZh,
      textEn,
      textStyle: ["default", "highlight", "info"].includes(textStyle)
        ? textStyle
        : "default",
      transition: transition.replace(/\s/g, ""),
      description,
    });
  }

  return segments;
}

// ── Main ────────────────────────────────────────────
async function main() {
  console.log("🎬 短影音自動剪輯 Pipeline 啟動\n");
  console.log(`📌 專案名稱：${PROJECT_NAME}`);
  if (PROJECT_FOLDER) console.log(`📂 素材資料夾：public/${PROJECT_FOLDER}/`);
  console.log(`📋 剪輯方向：${EDITING_DIRECTION}`);

  const logger = new PipelineLogger(PROJECT_NAME);

  // Header
  logger.add(`# ${PROJECT_NAME} - 短影音剪輯紀錄`);
  logger.add(``);
  logger.add(`- 建立時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`);
  logger.add(`- Gemini 模型：\`${GEMINI_MODEL}\``);
  logger.add(`- OpenAI 模型：\`${OPENAI_MODEL}\``);
  logger.add(``);
  logger.add(`### 剪輯方向`);
  logger.add(``);
  logger.add(`> ${EDITING_DIRECTION.replace(/\n/g, "\n> ")}`);
  logger.add(``);
  logger.add(`---`);
  logger.add(``);

  // Step 1: Gemini 分析
  const analyses = await analyzeVideos(logger);

  // 儲存分析結果 JSON
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "analyses.json"),
    JSON.stringify(analyses, null, 2),
    "utf-8"
  );
  logger.add(`---`);
  logger.add(``);

  // Step 2: OpenAI 產生腳本
  const scriptText = await generateScript(analyses, logger);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "script-raw.txt"),
    scriptText,
    "utf-8"
  );

  // Step 3: 解析為 JSON
  const segments = parseScript(scriptText);

  const scriptJson = {
    title: PROJECT_NAME,
    fps: 30,
    width: 1080,
    height: 1920,
    editingDirection: EDITING_DIRECTION,
    segments,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "script.json"),
    JSON.stringify(scriptJson, null, 2),
    "utf-8"
  );

  // Step 3 log
  logger.add(`## Step 3：結構化腳本（JSON）`);
  logger.add(``);
  logger.add(`共 **${segments.length}** 個片段：`);
  logger.add(``);
  logger.add(`| # | 檔案 | 時長 | 字幕 | 樣式 | 轉場 |`);
  logger.add(`|---|------|------|------|------|------|`);
  segments.forEach((s, i) => {
    logger.add(
      `| ${i + 1} | ${s.filename} | ${s.durationSeconds}s | ${s.textZh} | ${s.textStyle} | ${s.transition} |`
    );
  });
  logger.add(``);

  logger.add(`<details>`);
  logger.add(`<summary>完整 JSON</summary>`);
  logger.add(``);
  logger.add("```json");
  logger.add(JSON.stringify(scriptJson, null, 2));
  logger.add("```");
  logger.add(``);
  logger.add(`</details>`);
  logger.add(``);
  logger.add(`---`);
  logger.add(``);
  logger.add(`## Step 4：Remotion 剪輯`);
  logger.add(``);
  logger.add(`> 待生成 Remotion composition 後補充`);
  logger.add(``);

  // Step 4: 配樂推薦 & 上架關鍵字
  console.log(`\n🎵 Step 4：產生配樂推薦與上架關鍵字...\n`);
  const recommend = await generateRecommendations(scriptJson, analyses);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "recommend.json"),
    JSON.stringify(recommend, null, 2),
    "utf-8"
  );

  // Step 4 log
  logger.add(`## Step 4：配樂推薦 & 上架關鍵字`);
  logger.add(``);
  logger.add(`### 🎵 配樂推薦`);
  logger.add(``);
  logger.add(`- 氛圍：${recommend.music.mood}`);
  logger.add(`- 風格：${recommend.music.suggestedGenres.join(", ")}`);
  logger.add(`- BPM：${recommend.music.bpmRange}`);
  logger.add(`- 搜尋關鍵字：${recommend.music.searchKeywords.join(", ")}`);
  logger.add(``);
  logger.add(`| # | 曲名 | 藝人 | 來源 | 版權 |`);
  logger.add(`|---|------|------|------|------|`);
  recommend.music.recommendations.forEach((r, i) => {
    logger.add(`| ${i + 1} | ${r.track} | ${r.artist} | ${r.source} | ${r.copyrightNote} |`);
  });
  logger.add(``);
  logger.add(`### 🏷️ 上架關鍵字`);
  logger.add(``);
  logger.add(`**YouTube Tags:** ${recommend.seo.youtube.tags.join(", ")}`);
  logger.add(``);
  logger.add(`**Instagram Hashtags:** ${recommend.seo.instagram.hashtags.join(" ")}`);
  logger.add(``);
  if (recommend.seo.tiktok) {
    logger.add(`**TikTok Hashtags:** ${recommend.seo.tiktok.hashtags.join(" ")}`);
    logger.add(``);
  }

  // 儲存 markdown
  logger.save();

  console.log(`\n✅ Pipeline 完成！共 ${segments.length} 個片段`);
  console.log(`📝 紀錄檔：${logger.filepath}`);
  console.log("\n📋 腳本摘要：");
  segments.forEach((s, i) => {
    console.log(
      `   片段 ${i + 1}: ${s.filename} (${s.durationSeconds}s) - ${s.textZh}`
    );
  });

  // 配樂摘要
  console.log("\n🎵 配樂推薦：");
  recommend.music.recommendations.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.track} - ${r.artist} (${r.source})`);
  });
  console.log(`\n🔍 音樂庫搜尋關鍵字：${recommend.music.searchKeywords.join(", ")}`);
}

main().catch(console.error);
