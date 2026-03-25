/**
 * 配樂推薦 & 上架關鍵字產生器
 *
 * 用法：
 *   獨立執行：node scripts/recommend.mjs
 *   搭配 pipeline：由 pipeline.mjs Step 4 自動呼叫
 *
 * 讀取 scripts/output/script.json + analyses.json，
 * 透過 OpenAI 產出配樂推薦與上架關鍵字，
 * 輸出至 scripts/output/recommend.json
 */
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OUTPUT_DIR = path.resolve(__dirname, "output");

/**
 * 產生配樂推薦與上架關鍵字
 * @param {object} scriptJson - script.json 的內容
 * @param {Array} analyses - analyses.json 的內容
 * @returns {object} 推薦結果
 */
export async function generateRecommendations(scriptJson, analyses) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const videoSummary = analyses
    .map((a) => `【${a.filename}】${a.analysis.slice(0, 200)}`)
    .join("\n");

  const scriptSummary = scriptJson.segments
    .map(
      (s, i) =>
        `片段${i + 1}: ${s.textZh} (${s.durationSeconds}s, 轉場:${s.transition})`
    )
    .join("\n");

  const totalDuration = scriptJson.segments.reduce(
    (sum, s) => sum + s.durationSeconds,
    0
  );

  const systemPrompt = `# Role
你是一位資深短影音製作人，同時精通社群行銷與音樂選曲。

# Task
根據使用者提供的影片分析與剪輯腳本，產出：
1. 配樂推薦（含具體曲目、風格、BPM 範圍）
2. 上架關鍵字（YouTube Tags、Instagram Hashtags、影片標題與描述建議）

# Output Format
請嚴格使用以下 JSON 格式回覆，不要加任何多餘文字：

{
  "music": {
    "mood": "影片整體氛圍描述",
    "suggestedGenres": ["風格1", "風格2"],
    "bpmRange": "BPM 範圍，例如 90-120",
    "recommendations": [
      {
        "track": "曲名",
        "artist": "藝人",
        "reason": "推薦原因",
        "source": "可取得平台（如 YouTube Audio Library / Epidemic Sound / Artlist）",
        "copyrightNote": "版權提醒"
      }
    ],
    "searchKeywords": ["在音樂庫搜尋用的關鍵字1", "關鍵字2"],
    "editingTips": "配樂與剪輯搭配建議"
  },
  "seo": {
    "youtube": {
      "titleSuggestions": ["標題建議1", "標題建議2"],
      "description": "影片描述建議（含 CTA）",
      "tags": ["tag1", "tag2", "...最多20個"]
    },
    "instagram": {
      "caption": "Instagram 貼文文字建議",
      "hashtags": ["#hashtag1", "#hashtag2", "...最多30個"]
    },
    "tiktok": {
      "caption": "TikTok 文字建議",
      "hashtags": ["#hashtag1", "#hashtag2"]
    }
  }
}

# Constraints
1. 配樂推薦至少 3 首，優先推薦免版稅或容易取得授權的音樂
2. 推薦曲目需標明版權狀態與可取得平台
3. 搜尋關鍵字需包含英文（方便在國際音樂庫搜尋）
4. YouTube tags 需混合中英文，涵蓋地點、主題、風格
5. Instagram hashtags 需混合中英文熱門標籤
6. 所有文字使用繁體中文（hashtags 除外）`;

  const userMessage = `# 影片資訊
- 標題：${scriptJson.title}
- 剪輯方向：${scriptJson.editingDirection}
- 總時長：約 ${totalDuration} 秒
- 尺寸：${scriptJson.width}x${scriptJson.height}（直式短影音）

# 影片內容分析摘要
${videoSummary}

# 剪輯腳本
${scriptSummary}

請根據以上資訊，產出配樂推薦與上架關鍵字。`;

  console.log(`\n🎵 呼叫 OpenAI (${OPENAI_MODEL}) 產生配樂推薦與關鍵字...\n`);

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  const result = JSON.parse(content);

  return result;
}

/**
 * 將推薦結果輸出為易讀的 console 摘要
 */
function printSummary(result) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`🎵 配樂推薦`);
  console.log(`${"═".repeat(50)}`);
  console.log(`氛圍：${result.music.mood}`);
  console.log(`風格：${result.music.suggestedGenres.join(", ")}`);
  console.log(`BPM：${result.music.bpmRange}`);
  console.log(`\n搜尋關鍵字：${result.music.searchKeywords.join(", ")}`);
  console.log(`\n推薦曲目：`);
  result.music.recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.track} - ${r.artist}`);
    console.log(`     ${r.reason}`);
    console.log(`     📍 ${r.source} | ${r.copyrightNote}`);
  });
  console.log(`\n💡 ${result.music.editingTips}`);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`🏷️  上架關鍵字`);
  console.log(`${"═".repeat(50)}`);

  console.log(`\n📺 YouTube:`);
  console.log(`  標題建議：`);
  result.seo.youtube.titleSuggestions.forEach((t) => console.log(`    • ${t}`));
  console.log(`  Tags: ${result.seo.youtube.tags.join(", ")}`);

  console.log(`\n📸 Instagram:`);
  console.log(`  Hashtags: ${result.seo.instagram.hashtags.join(" ")}`);

  if (result.seo.tiktok) {
    console.log(`\n🎵 TikTok:`);
    console.log(`  Hashtags: ${result.seo.tiktok.hashtags.join(" ")}`);
  }
}

// ── 獨立執行 ──────────────────────────────────────
async function main() {
  const scriptPath = path.join(OUTPUT_DIR, "script.json");
  const analysesPath = path.join(OUTPUT_DIR, "analyses.json");

  if (!fs.existsSync(scriptPath) || !fs.existsSync(analysesPath)) {
    console.error(
      "❌ 找不到 script.json 或 analyses.json，請先執行 pipeline.mjs"
    );
    process.exit(1);
  }

  const scriptJson = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const analyses = JSON.parse(fs.readFileSync(analysesPath, "utf-8"));

  const result = await generateRecommendations(scriptJson, analyses);

  // 儲存 JSON
  const outputPath = path.join(OUTPUT_DIR, "recommend.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n✅ 推薦結果已儲存至 ${outputPath}`);

  printSummary(result);
}

// 僅在直接執行時啟動 main
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch(console.error);
}
