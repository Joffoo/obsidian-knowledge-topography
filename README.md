# Obsidian Knowledge Topography (知识地貌)

[![Release](https://img.shields.io/github/v/release/Joffoo/obsidian-knowledge-topography?style=flat-square)](https://github.com/Joffoo/obsidian-knowledge-topography/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Obsidian Downloads](https://img.shields.io/badge/Obsidian-Community%20Plugin-7952b3.svg?style=flat-square)](https://obsidian.md/plugins)

[中文说明](#-中文说明) | [English Documentation](#-english-documentation)

---

## 🇨🇳 中文说明

**Knowledge Topography (知识地貌)** 是一款专为 Obsidian 打造的语义等高线地形图插件。它通过高维文本嵌入向量（Embeddings）、UMAP 降维流形学习以及二维高斯核密度估计（2D Gaussian KDE），将你的个人笔记库渲染为层叠起伏的 **80 层等高线地貌全景图** —— 直观揭示思维的语义聚集、知识山峦（Peaks）与概念峡谷。

### ✨ 核心特性

- 🏔️ **80 层微地形等高线**：平滑细腻的高阶等高线算法，将抽象的笔记密度转化为生动的地理海拔与连绵山脉。
- 🎯 **语义雷达探针与实时近邻定位 (Radar Probe)**：当你在 Obsidian 中切换正在编辑的笔记时，地貌地图自动自适应平移聚焦至目标坐标，点亮雷达光斑；底部浮现高质感毛玻璃 HUD 卡片，实时显示所属山峰主题及相似度最高的 **Top-3 语义近邻笔记**，支持一键点击直接打开。
- 🧭 **自由漫游与全貌回归 (Free Navigation & Reset)**：全面解锁地图自由平移浏览（Pan），并通过右上角风格胶囊内置的微型回归按钮 `⟲` 或在空白画布**双击鼠标**瞬间平滑回归完整地貌全景。
- 🏷️ **自适应山峰识别与 AI 领域命名**：采用自适应带宽核密度与局部非极大值抑制（NMS）自动锚定知识高地，并支持联动大语言模型（如 DeepSeek、OpenAI、本地 Ollama 等）自动提炼各山峰的主题领域。
- 🌐 **双语界面原生支持 (i18n)**：设置后台与视图均提供原生的 **简体中文** 与 **English** 双语支持，并支持自动跟随 Obsidian 客户端语言。
- 🎨 **7 款手工定制的美学主题**：
  - **宋代青绿山水 (Shanshui)**：文人界画设色、矿物石青石绿渐变与朱砂印章山标。
  - **普鲁士工程蓝图 (Blueprint)**：坐标网格底纹、工程图纸准心与严谨测量质感。
  - **深空韦伯星云 (Stellar)**：深邃宇宙星图感、恒星光芒标记。
  - **瑞士国际主义 (Swiss Minimal)**：现代主义网格系统、极简黑白方块与理性排版。
  - **和纸苔藓若竹 (Matcha & Bamboo)**：枯山水苔庭意境、禅意圆环与自然呼吸感。
  - **文艺复兴手稿 (Da Vinci)**：达芬奇羊皮纸复古棕褐手稿风。
  - **现代极夜深蓝 (Contemporary)**：合成雷达暗色系与现代数字化界面。
- ⚡ **灵活的双模向量引擎**：
  - **在线接口 (OpenAI 兼容 API)**：无缝直连本地 Ollama（如 `http://localhost:11434/v1`）、硅基流动（SiliconFlow）、DeepSeek 或 OpenAI。
  - **本地模型 (完全离线推理)**：支持本地直接加载 ONNX 嵌入模型（如 `bge-m3`、`jina-embeddings-v2`），全程无断网隐忧。
- 🔌 **一键连通性测试**：设置面板为向量接口与山峰命名接口均内置了快捷“测试连接”功能，避免因配置错误导致构建失败。
- 🌐 **独立交互式 HTML 导出**：可导出为完全自包含的交互式网页，支持脱离 Obsidian 在任意浏览器中独立浏览、平移、缩放与查看笔记卡片。
- 🔒 **严格隐私与零外部遥测**：计算全在本地或你指定的 API 服务完成，无任何用户行为跟踪、遥测或第三方云端依赖。

### 🚀 安装方式

#### 方式一：官方社区插件市场（推荐）
1. 打开 Obsidian **设置** → **第三方插件**。
2. 关闭 **安全模式**。
3. 点击 **浏览** 并搜索 `Knowledge Topography`。
4. 点击 **安装** 并 **启用**。

#### 方式二：通过 BRAT 测试版安装
1. 安装 [BRAT 插件](https://github.com/TfTHacker/obsidian-4rw-brat)。
2. 在 BRAT 中添加测试仓库：`Joffoo/obsidian-knowledge-topography`。

#### 方式三：手动安装
1. 前往最新的 [GitHub Releases](https://github.com/Joffoo/obsidian-knowledge-topography/releases) 页面。
2. 下载 `main.js`、`manifest.json` 与 `styles.css` 这 3 个文件。
3. 在你的笔记库中，进入 `<配置目录>/plugins/`（默认通常为 `.obsidian/plugins/`）并新建文件夹 `knowledge-topography`。
4. 将下载的 3 个文件放入该文件夹中。
5. 重新加载 Obsidian 并在设置中启用插件。

### 🛠️ 快速上手与设置说明

1. 点击左侧边栏的 **地图图标**，或在命令面板中运行 `查看知识地貌` (`Open Knowledge Topography`)。
2. 首次使用请进入 **插件设置 (Knowledge Topography)**：
   - **界面语言 (Language)**：选择 `自动跟随系统`、`简体中文` 或 `English`。
   - **地貌计算 (Topography Engine)**：
     - 选择 `在线接口 (兼容 OpenAI)` 并填写服务地址（如 Ollama 或云端 API）与模型名称（如 `text-embedding-3-small` / `bge-m3`），轻点 **测试连接** 确保通畅。
     - 或选择 `本地模型 (完全离线)` 并指定包含 ONNX 模型的本地文件夹路径。
   - **山峰命名 (Peak Naming)**：（可选）配置对话大语言模型（如 `gpt-4o-mini` 或 `deepseek-chat`）与 API Key，自动提炼山峰领域。
   - **扫描范围 (Scan Scope)**：按需配置需排除的文件夹（默认忽略 `_templates`, `_attachments` 等）与单篇采样字数。
3. 点击视图中的 **构建地貌** 按钮。
4. 地图生成后即可随心探索知识地貌，点击任意散点可直接定位并打开对应笔记。

### ⚙️ 环境要求

- **Obsidian 版本**：v1.8.7 或更高版本。
- **运行平台**：桌面端（macOS、Windows、Linux），因涉及流形降维矩阵运算与本地运行支撑，暂不支持移动端。

---

## 🌐 English Documentation

**Knowledge Topography** transforms your Obsidian vault into an interactive semantic landscape. Using high-dimensional embeddings, UMAP dimensionality reduction, and 2D Gaussian Kernel Density Estimation (KDE), it renders your notes as an **80-level topographic contour map** — revealing conceptual mountain ranges, thematic peaks, and hidden valleys of thought.

### ✨ Features

- 🏔️ **80-Level Topographic Contours**: Generates smooth, high-precision contour lines reflecting note semantic density across your vault.
- 🎯 **Semantic Radar Probe & Real-time Neighbor HUD (Radar Probe)**: When switching active notes in Obsidian, the topography map smoothly pans and centers on the note's coordinates with an animated radar pulse ripple. A glassmorphic HUD card reveals the summit domain and top-3 closest semantic neighbors with instant click-to-open access.
- 🧭 **Free Navigation & Seamless Reset (Free Pan & Reset)**: Freely drag and pan across the terrain. Instantly reset to the full global overview by clicking the subtle `⟲` button on the top-right capsule or by double-clicking anywhere on the empty canvas.
- 🏷️ **Intelligent Mountain Peak Detection & AI Naming**: Automatically identifies semantic summits using localized non-maximum suppression (NMS) and synthesizes domain labels via LLMs (e.g., DeepSeek, OpenAI, Ollama).
- 🌐 **Native Bilingual Interface (i18n)**: Fully localized settings and view panels in both **English** and **Simplified Chinese**, supporting automatic language detection.
- 🎨 **7 Handcrafted Aesthetic Themes**:
  - **宋代青绿山水 (Shanshui)**: Traditional Chinese landscape painting with mineral pigments and red seal badges.
  - **普鲁士工程蓝图 (Blueprint)**: Technical precision cyanotype with technical crosshair markers.
  - **深空韦伯星云 (Stellar)**: Deep cosmic nebula survey aesthetic with stellar marks.
  - **瑞士国际主义 (Swiss Minimal)**: Helvetica-inspired modernist layout with clean typographic boxes.
  - **和纸苔藓若竹 (Matcha & Bamboo)**: Zen garden atmosphere with subtle matcha green gradients.
  - **文艺复兴手稿 (Da Vinci)**: Renaissance parchment with vintage sepia tonality.
  - **现代极夜深蓝 (Contemporary)**: Sleek synthetic radar dark mode.
- ⚡ **Flexible Embedding Engines**:
  - **Online API (OpenAI Compatible)**: Seamlessly connect to Ollama (local `http://localhost:11434/v1`), SiliconFlow, DeepSeek, or OpenAI endpoints.
  - **Local Model (Fully Offline)**: Run completely offline using local ONNX embeddings (e.g., `bge-m3`, `jina-embeddings-v2`).
- 🔌 **Built-in Connection Diagnostics**: Test your API configuration with a single click before initiating full builds.
- 🌐 **Interactive Standalone HTML Export**: Export a self-contained, publication-ready interactive HTML file that can be opened in any modern browser without Obsidian running.
- 🔒 **Zero Telemetry & Strict Privacy**: All processing runs locally within your vault or connects solely to your designated API endpoint. No external user tracking or telemetry.

### 🚀 Installation

#### Via Community Plugins (Recommended)
1. Open **Obsidian Settings** → **Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse** and search for `Knowledge Topography`.
4. Click **Install**, then **Enable**.

#### Via BRAT
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian-4rw-brat).
2. Add beta plugin: `Joffoo/obsidian-knowledge-topography`.

#### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/Joffoo/obsidian-knowledge-topography/releases).
2. In your vault, navigate to `<config-dir>/plugins/` (usually `.obsidian/plugins/`) and create a folder named `knowledge-topography`.
3. Place the downloaded files inside that folder.
4. Reload Obsidian and enable the plugin in settings.

### 🛠️ Getting Started & Configuration

1. Click the **Map icon** on the left ribbon or run the command `Open Knowledge Topography` (`查看知识地貌`).
2. Go to **Plugin Settings (Knowledge Topography)**:
   - **Language**: Choose `Auto (System Default)`, `English`, or `简体中文`.
   - **Topography Engine**:
     - Choose `Online API (OpenAI Compatible)` and enter your server URL (e.g. Ollama or cloud endpoint) and embedding model name (e.g., `text-embedding-3-small`), then click **Test Link**.
     - Or choose `Local Model (Offline)` and specify the local directory containing your ONNX model.
   - **Peak Naming**: (Optional) Configure a chat completion model (e.g. `gpt-4o-mini` or `deepseek-chat`) to automatically generate summits' domain names.
   - **Scan Scope**: Customize folders to skip (defaults to `_templates, _attachments`) and per-note sample sizes.
3. Click **Build Topography** in the view panel.
4. Enjoy exploring your knowledge landscape! Click on any note point to jump directly to the corresponding note.

### ⚙️ Requirements & Compatibility

- **Obsidian**: v1.8.7 or higher.
- **Platform**: Desktop only (macOS, Windows, Linux). Requires desktop environment for spatial matrix computations and local rendering.

---

### 📄 License

This project is licensed under the [MIT License](LICENSE).
