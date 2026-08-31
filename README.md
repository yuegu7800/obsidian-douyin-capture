# 月·抖音知识库（Douyin Capture）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> This repository is a customized fork maintained by **yuegu7800**, based on the original MIT-licensed project by **lyxdream**. The customized build is displayed in Obsidian as **月·抖音知识库**. Version 1.1.0+ focuses on local knowledge extraction: batch import, duplicate prevention, search/recommendations, OCR-first captions, local Whisper fallback, and automatic cleanup of temporary media.

> 本仓库是 **yuegu7800** 维护的定制版本，基于 **lyxdream** 的 MIT 开源项目。在 Obsidian 中显示为 **月·抖音知识库**，用于和原版插件区分。1.1.0+ 重点面向本地知识库：批量导入、自动查重、搜索与相关推荐、字幕 OCR 优先、Whisper 语音兜底，以及临时视频/音频自动清理。

**Language / 语言:** [English](#english) · [中文](#chinese)

---

<h2 id="english">English</h2>

Import Douyin (TikTok China) share links or pasted share text into your Obsidian vault. Download no-watermark videos, carousel images, and captions, then create structured notes with titles, hashtags, tags, and frontmatter. Video posts can be transcribed to Simplified Chinese with a local Whisper backend. All media stays on your machine.

> **Required:** This customized plugin depends on the matching local Python backend configured on your computer. The upstream backend link is kept for attribution and reference, but the OCR/search extensions currently live in your modified local installation. Nothing is sent to a paid speech or AI service.

### Features

| Capability | Description |
|------------|-------------|
| Video posts | OCR visible captions first; fall back to local Whisper when needed |
| Image posts | OCR text from carousel images and retain source captions |
| Batch & dedup | Import multiple links at once; existing `douyin_id` entries are skipped |
| Discovery | Search Douyin content and open a separate related-content workflow |
| Knowledge-first storage | Temporary video/audio can be deleted after extraction; keep transcript and metadata |
| Note structure | Title separated from `#hashtags`, tag callout block, frontmatter metadata |
| Privacy | No Douyin cookie required, no paid speech API, data stays local |
| Resilience | Notes are still created when captions succeed but video or some images fail to import |

Supported link formats: `v.douyin.com` short links, `www.douyin.com/note|video`, `iesdouyin.com/share/...`, or pasted share text containing a link.

### Requirements

| Component | Requirement |
|-----------|-------------|
| Obsidian | **Desktop** 1.4.0+ (mobile not supported) |
| Local backend | [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend) |
| Python | 3.10+ (backend) |
| FFmpeg | Required for **video transcription** only (`brew install ffmpeg`, etc.) |
| Network | Internet needed to download Douyin assets and the first Whisper model |

Default backend URL: `http://127.0.0.1:5050`

### Quick start

#### 1. Start the local backend

```bash
git clone https://github.com/lyxdream/obsidian-content-capture-backend.git
cd obsidian-content-capture-backend

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# macOS — video transcription
brew install ffmpeg

python web/app.py
# Optional: open http://127.0.0.1:5050 in a browser for testing
```

Keep the terminal running. The plugin cannot extract content after the backend stops.

#### 2. Install this plugin

**From Releases (recommended)**

1. Open [Releases](https://github.com/yuegu7800/obsidian-douyin-capture/releases) and download the build for your version (`main.js`, `manifest.json`, `styles.css`).
2. Extract into your vault:

   ```
   <Your Vault>/.obsidian/plugins/douyin-capture/
   ├── main.js
   ├── manifest.json
   ├── styles.css
   └── versions.json   # if included
   ```

3. Obsidian → **Settings → Community plugins** → turn off Restricted mode → enable **月·抖音知识库**.

**With BRAT (easy updates)**

Install the BRAT community plugin, choose **Add Beta plugin**, and enter `yuegu7800/obsidian-douyin-capture`.

**From the community catalog**

This customized build is distributed through GitHub Releases/BRAT and is not yet listed in the official community catalog.

**Build from source**

```bash
git clone https://github.com/yuegu7800/obsidian-douyin-capture.git
cd obsidian-douyin-capture
npm install
npm run build
```

Copy the plugin folder (including generated `main.js`) into `.obsidian/plugins/douyin-capture/`, or symlink it during development.

#### 3. Configure the plugin

**Settings → 月·抖音知识库**

| Option | Default | Description |
|--------|---------|-------------|
| Backend URL | `http://127.0.0.1:5050` | Must match `web/app.py` |
| Whisper model | `medium` | Used when OCR is unavailable or insufficient; larger models are slower but often more accurate |
| Note folder | `Douyin` | Relative to vault root |
| Attachment folder | `attachments/douyin` | Where videos and images are stored |
| Embed video | On | When off, notes keep a link instead of `![[video]]` |
| Open note after create | On | Open the new note when import finishes |

The settings page shows backend status (connected / disconnected).

### Usage

**Ribbon icon** — Click the camera icon in the left ribbon to open the **import douyin** modal.

**Modal actions**

1. Paste a Douyin share link or full share text.
2. Choose:
   - **Extract caption** — full pipeline (Whisper for videos; images + caption for image posts)
   - **Extract video** — download no-watermark video only, **no transcription**
   - **Cancel** — close the modal

Progress steps are shown during extraction (health check → parse/download → write to vault).

**Command palette**

| Command | Description |
|---------|-------------|
| 月·抖音知识库: Create note from URL | Open the import modal |
| 月·抖音知识库: Create note from clipboard | Read link from clipboard (full caption extract) |
| 月·抖音知识库: Check backend connection | Test `GET /api/health` |

**Generated notes**

- **Path:** `Douyin/2026-06-04-author-title-slug.md`
- **Body:** level-1 title, hashtag callout, video/images, `## Caption`
- **Frontmatter:** `type`, `content_type`, `douyin_id`, `author`, `source`, `tags`, etc.

See [`docs/obsidian-plugin-contract.md`](docs/obsidian-plugin-contract.md) for field details and fallback templates.

### Architecture

```
┌─────────────────┐     HTTP (localhost)     ┌──────────────────────────────┐
│  Obsidian       │  POST /api/video/extract │  obsidian-content-capture-   │
│  月·抖音知识库   │ ───────────────────────► │  backend (Python + Flask)    │
│  plugin         │ ◄─────────────────────── │  parse / download / Whisper  │
└────────┬────────┘                          └──────────────────────────────┘
         │ copy media + write .md
         ▼
┌─────────────────┐
│  Vault          │
│  Douyin/*.md    │
│  attachments/…  │
└─────────────────┘
```

The plugin calls the API, copies media from `output/` into the vault, and renders Markdown. Core extraction runs in the backend.

### FAQ

| Issue | What to do |
|-------|------------|
| Cannot connect to local service | Ensure `python web/app.py` is running; check backend URL and port in settings |
| UI unchanged after reload | `Cmd+P` → **Reload app without saving**, or disable and re-enable the plugin |
| Video extract is slow | Local Whisper transcription is expected; try a smaller model (`tiny` / `base`) or **Extract video** first |
| Old note format | Existing notes are not updated; re-import the link |
| Text only in images | Choose **Smart auto** or **OCR first**; the backend reads visible captions locally |
| `main.js` missing | Run `npm run build`, or download a Release build |

### Development

```bash
npm install
npm run dev      # watch build
npm run build    # production → main.js
```

| Path | Role |
|------|------|
| `src/main.ts` | Plugin entry, commands, extract flow |
| `src/modal.ts` | Import modal UI |
| `src/vaultWriter.ts` | Note and attachment writes |
| `src/backend.ts` | Backend HTTP client |
| `docs/obsidian-plugin-contract.md` | Plugin behavior and API contract |

Backend development: [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend).

### License and disclaimer

This project is licensed under [MIT](LICENSE).

Douyin content and platform rules belong to the platform. Use this tool for **personal learning and research** only. Do not use it for copyright infringement or terms-of-service violations. The author is not responsible for consequences of using this tool.

---

<h2 id="chinese">中文</h2>

将抖音分享链接一键导入 Obsidian：在本地提取**视频 / 配图 / 文案**，自动生成结构化笔记。

> **重要**：本定制插件依赖你电脑中已经配置好的配套 Python 后端。上游后端链接仅用于保留出处与参考；OCR、搜索等扩展目前保存在你的本地修改版后端中。链接和媒体不会发送给付费语音或 AI 服务。

### 功能亮点

| 能力 | 说明 |
|------|------|
| 视频作品 | 优先 OCR 识别画面字幕，文字不足时使用本地 Whisper 语音识别兜底 |
| 图文作品 | OCR 识别全部配图中的文字，并保留 `desc` 配文 |
| 批量与查重 | 一次粘贴多条链接；已存在相同 `douyin_id` 的内容自动跳过 |
| 搜索与相关推荐 | 提供独立入口搜索抖音内容，并可继续查找相关作品 |
| 知识优先 | **提取文案**完成后自动清理临时视频/音频；**提取视频**仍可保存视频 |
| 笔记结构 | 标题与 `#话题` 分离、标签引用块、frontmatter 元数据 |
| 隐私 | 无需抖音 Cookie、无需付费语音 API，数据留在本机 |
| 容错 | 文案成功但视频/部分配图导入失败时，仍会创建笔记并给出降级说明 |

支持的链接形式：`v.douyin.com` 短链、`www.douyin.com/note|video`、`iesdouyin.com/share/...`，或直接粘贴整段分享文案。

### 环境要求

| 组件 | 要求 |
|------|------|
| Obsidian | **桌面版** 1.4.0+（不支持移动端） |
| 本地后端 | [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend) |
| Python | 3.10+（后端） |
| FFmpeg | 仅**视频转写**需要（`brew install ffmpeg` 等） |
| 网络 | 首次 Whisper 需下载模型；解析/下载抖音资源需联网 |

默认后端地址：`http://127.0.0.1:5050`

### 快速开始

#### 1. 启动本地后端

```bash
git clone https://github.com/lyxdream/obsidian-content-capture-backend.git
cd obsidian-content-capture-backend

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# macOS 视频转写需要
brew install ffmpeg

python web/app.py
# 浏览器可打开 http://127.0.0.1:5050 做联调
```

终端保持运行；关闭后插件将无法提取。

#### 2. 安装本插件

**方式 A：从 Release 安装（推荐）**

1. 打开 [Releases](https://github.com/yuegu7800/obsidian-douyin-capture/releases)，下载对应版本（需包含 `main.js`、`manifest.json`、`styles.css`）。
2. 解压到库目录：

   ```
   <你的 Vault>/.obsidian/plugins/douyin-capture/
   ├── main.js
   ├── manifest.json
   ├── styles.css
   └── versions.json   # 若有
   ```

3. Obsidian → **设置 → 第三方插件 → 关闭安全模式 → 启用「月·抖音知识库」**。

**方式 B：使用 BRAT 自动更新**

安装社区插件 BRAT，选择 **Add Beta plugin**，输入 `yuegu7800/obsidian-douyin-capture`。

**方式 C：社区插件市场**

该定制版本目前通过 GitHub Release/BRAT 分发，尚未进入 Obsidian 官方社区插件市场。

**方式 D：手动构建**

```bash
git clone https://github.com/yuegu7800/obsidian-douyin-capture.git
cd obsidian-douyin-capture
npm install
npm run build
```

将**整个插件目录**（含生成的 `main.js`）放入 `.obsidian/plugins/douyin-capture/`，或在开发时用符号链接指向该目录。

#### 3. 配置插件

**设置 → 月·抖音知识库**：

| 选项 | 默认 | 说明 |
|------|------|------|
| 后端地址 | `http://127.0.0.1:5050` | 与 `web/app.py` 一致 |
| Whisper 模型 | `medium` | OCR 不可用或文字不足时作为语音兜底；越大越慢但通常更准 |
| 笔记文件夹 | `Douyin` | 相对 Vault 根目录 |
| 附件文件夹 | `attachments/douyin` | 视频/图片存放位置 |
| 嵌入视频 | 开启 | 关闭则笔记内仅保留链接 |
| 创建后打开笔记 | 开启 | 完成后自动打开新笔记 |

页面顶部会显示后端连接状态（● 已连接 / ● 未连接）。

### 使用说明

**侧边栏** — 点击左侧 Ribbon 的**摄像机图标**，打开 **import douyin** 弹窗。

**弹窗操作**

1. 粘贴抖音分享链接或整段分享文案
   - 可一次粘贴多条链接，插件会自动去重并逐条处理
2. 选择：
   - **提取文案**：完整流程（视频含 Whisper 转写，图文含配图与配文）
   - **提取视频**：仅下载无水印视频并写入笔记，**不进行转写**（适合先存视频、稍后再转写）
   - **取消**：关闭弹窗

提取过程中会显示步骤进度（检查服务 → 解析/下载 → 写入 Vault）。

**命令面板**

| 命令 | 说明 |
|------|------|
| 月·抖音知识库：从抖音链接创建笔记 | 打开导入弹窗 |
| 月·抖音知识库：从剪贴板创建笔记 | 读取剪贴板中的链接（完整提取文案） |
| 月·抖音知识库：检查后端连接 | 测试 `GET /api/health` |

**生成的笔记示例**

- **路径**：`Douyin/2026-06-04-作者-标题摘要.md`
- **正文**：一级标题 + 话题标签引用块 + 视频/配图 + `## 文案`
- **Frontmatter**：`type`、`content_type`、`douyin_id`、`author`、`source`、`tags` 等

详细字段与失败降级模板见 [`docs/obsidian-plugin-contract.md`](docs/obsidian-plugin-contract.md)。

### 架构说明

```
┌─────────────────┐     HTTP (localhost)     ┌──────────────────────────────┐
│  Obsidian       │  POST /api/video/extract │  obsidian-content-capture-   │
│  月·抖音知识库   │ ───────────────────────► │  backend (Python + Flask)    │
│  插件           │ ◄─────────────────────── │  解析 / 下载 / Whisper       │
└────────┬────────┘                          └──────────────────────────────┘
         │ 拷贝 media + 写 .md
         ▼
┌─────────────────┐
│  Vault          │
│  Douyin/*.md    │
│  attachments/…  │
└─────────────────┘
```

插件只负责调用 API、把 `output/` 中的媒体复制进 Vault、渲染 Markdown；核心能力由后端提供。

### 常见问题

| 现象 | 处理 |
|------|------|
| 提示「无法连接本地服务」 | 确认 `python web/app.py` 在运行；检查设置中的后端地址与端口 |
| 重载插件后界面没变 | `Cmd+P` → **Reload app without saving**；或关闭再启用插件 |
| 视频提取很慢 | 本地 Whisper 转写属正常，可改用更小模型（`tiny` / `base`）或先用「提取视频」 |
| 笔记格式是旧的 | 旧笔记不会自动更新，需重新导入一条链接 |
| 图文文字在图片里 | 选择「智能自动」或「字幕 OCR 优先」，后端会在本机识别可见文字 |
| `main.js` 不存在 | 执行 `npm run build`，或从 Release 下载已构建包 |

### 开发

```bash
npm install
npm run dev      # 监听编译
npm run build    # 生产构建 → main.js
```

| 路径 | 说明 |
|------|------|
| `src/main.ts` | 插件入口、命令、提取流程 |
| `src/modal.ts` | 导入弹窗 UI |
| `src/vaultWriter.ts` | 笔记与附件写入 |
| `src/backend.ts` | 后端 HTTP 客户端 |
| `docs/obsidian-plugin-contract.md` | 插件行为与 API 约定 |

后端开发见 [obsidian-content-capture-backend](https://github.com/lyxdream/obsidian-content-capture-backend)。

### 发布检查清单

向 [Obsidian 社区插件目录](https://community.obsidian.md) 提交前建议确认：

- [ ] `manifest.json`：`id` = `douyin-capture`，`version` 与 Release tag 一致，`minAppVersion` 正确
- [ ] `versions.json` 含对应版本键，与 manifest 一致
- [ ] 已执行 `npm run build`，**Release 附件包含 `main.js`**
- [ ] README 含英文说明，并注明**必须安装本地后端**
- [ ] `LICENSE` 与仓库一致（MIT）
- [ ] 在全新 Vault 中手动安装测试一遍完整流程

### 许可与声明

本项目采用 [MIT](LICENSE) 许可。

抖音内容与平台规则归原平台所有。请仅将本工具用于**个人学习与研究**，勿用于侵权或违反平台条款的用途。作者不对使用本工具产生的后果承担责任。
