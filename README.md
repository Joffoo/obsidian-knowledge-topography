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
- 🏷️ **自适应山峰识别与 AI 领域归纳**：采用自适应带宽核密度与局部非极大值抑制（NMS）自动锚定知识高地，并支持联动大语言模型（如 DeepSeek、OpenAI、本地 Ollama 等）自动提炼各山峰的主题领域。
- 🎨 **7 款手工定制的美学主题**：
  - **宋代青绿山水 (Shanshui)**：文人界画设色、矿物石青石绿渐变与朱砂印章山标。
  - **普鲁士工程蓝图 (Blueprint)**：坐标网格底纹、工程图纸准心与严谨测量质感。
  - **深空韦伯星云 (Stellar)**：深邃宇宙星图感、恒星光芒标记。
  - **瑞士国际主义 (Swiss Minimal)**：现代主义网格系统、极简黑白方块与理性排版。
  - **和纸苔藓若竹 (Matcha & Bamboo)**：枯山水苔庭意境、禅意圆环与自然呼吸感。
  - **文艺复兴手稿 (Da Vinci)**：达芬奇羊皮纸复古棕褐手稿风。
  - **现代极夜深蓝 (Contemporary)**：合成雷达暗色系与现代数字化界面。
- ⚡ **灵活的双模向量引擎**：
  - **OpenAI 兼容 API**：无缝直连本地 Ollama（`http://localhost:11434/v1`）、硅基流动（SiliconFlow）、DeepSeek 或 OpenAI。
  - **本地 ONNX 离线推理**：支持本地直接加载 ONNX 嵌入模型（如 `bge-m3`、`jina-embeddings-v2`），全程无断网隐忧。
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
3. 在你的笔记库中，进入 `.obsidian/plugins/` 目录并新建文件夹 `knowledge-topography`。
4. 将下载的 3 个文件放入 `.obsidian/plugins/knowledge-topography/`。
5. 重新加载 Obsidian 并在设置中启用插件。

### 🛠️ 快速上手

1. 点击左侧边栏的 **地图图标**，或在命令面板中运行 `打开语义知识地图` (`Open Knowledge Topography`)。
2. 首次使用请进入 **插件设置**：
   - **嵌入计算模式**：选择 `OpenAI 兼容 API`（可填写你的 API Key 或本地 Ollama 地址）或 `本地 ONNX 模型文件`。
   - **LLM 领域归纳**：（可选）配置大模型接口以自动提炼识别到的山峰主题。
3. 点击视图中的 **立即构建地图** 按钮。
4. 地图生成后即可随心探索知识地貌，点击任意散点可直接打开对应笔记。

### ⚙️ 环境要求

- **Obsidian 版本**：v1.5.0 或更高版本。
- **运行平台**：桌面端（macOS、Windows、Linux），因涉及大规模矩阵计算与本地文件生成，暂不支持移动端。

---

## 🌐 English Documentation

**Knowledge Topography** transforms your Obsidian vault into an interactive semantic landscape. Using high-dimensional embeddings, UMAP dimensionality reduction, and 2D Gaussian Kernel Density Estimation (KDE), it renders your notes as an **80-level topographic contour map** — revealing conceptual mountain ranges, thematic peaks, and hidden valleys of thought.

### ✨ Features

- 🏔️ **80-Level Topographic Contours**: Generates smooth, high-precision contour lines reflecting note semantic density across your vault.
- 🏷️ **Intelligent Mountain Peak Detection**: Automatically identifies semantic summits using localized non-maximum suppression (NMS) and synthesizes domain labels via LLMs (e.g., DeepSeek, OpenAI, Ollama).
- 🎨 **7 Handcrafted Aesthetic Themes**:
  - **宋代青绿山水 (Shanshui)**: Traditional Chinese landscape painting with mineral pigments and red seal badges.
  - **普鲁士工程蓝图 (Blueprint)**: Technical precision cyanotype with technical crosshair markers.
  - **深空韦伯星云 (Stellar)**: Deep cosmic nebula survey aesthetic with stellar marks.
  - **瑞士国际主义 (Swiss Minimal)**: Helvetica-inspired modernist layout with clean typographic boxes.
  - **和纸苔藓若竹 (Matcha & Bamboo)**: Zen garden atmosphere with subtle matcha green gradients.
  - **文艺复兴手稿 (Da Vinci)**: Renaissance parchment with vintage sepia tonality.
  - **现代极夜深蓝 (Contemporary)**: Sleek synthetic radar dark mode.
- ⚡ **Flexible Embedding Engines**:
  - **OpenAI-Compatible API**: Seamlessly connect to Ollama (local), SiliconFlow, DeepSeek, or OpenAI endpoints.
  - **Local ONNX Model**: Run fully offline using local ONNX embeddings (e.g., `bge-m3`, `jina-embeddings-v2`).
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
2. In your vault, navigate to `.obsidian/plugins/` and create a folder named `knowledge-topography`.
3. Place the downloaded files inside `.obsidian/plugins/knowledge-topography/`.
4. Reload Obsidian and enable the plugin in settings.

### 🛠️ Getting Started

1. Click the **Map icon** on the left ribbon or run the command `打开语义知识地图` (`Open Knowledge Topography`).
2. If this is your first time, go to **Plugin Settings**:
   - **Embedding Engine**: Choose `OpenAI 兼容 API` (e.g. Ollama `http://localhost:11434/v1` or cloud providers) or `本地 ONNX 模型文件`.
   - **LLM Synthesis**: (Optional) Provide your LLM endpoint to automatically label the detected peaks.
3. Click **立即构建地图** (Build Map).
4. Enjoy exploring your knowledge landscape! You can click on any note to open it directly in Obsidian.

### ⚙️ Requirements & Compatibility

- **Obsidian**: v1.5.0 or higher.
- **Platform**: Desktop only (macOS, Windows, Linux). Requires desktop environment for spatial matrix computations and local file rendering.

---

### 📄 License

This project is licensed under the [MIT License](LICENSE).
