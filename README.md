# Obsidian Knowledge Topography

[![Release](https://img.shields.io/github/v/release/Joffoo/obsidian-knowledge-topography?style=flat-square)](https://github.com/Joffoo/obsidian-knowledge-topography/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Obsidian Downloads](https://img.shields.io/badge/Obsidian-Community%20Plugin-7952b3.svg?style=flat-square)](https://obsidian.md/plugins)

**Knowledge Topography** (知识地貌) transforms your Obsidian vault into an interactive semantic landscape. Using high-dimensional embeddings, UMAP dimensionality reduction, and 2D Gaussian Kernel Density Estimation (KDE), it renders your notes as an 80-level topographic contour map — revealing conceptual mountain ranges, thematic peaks, and hidden knowledge valleys.

---

## ✨ Features

- 🏔️ **80-Level Topographic Contours**: Generates smooth, high-precision contour lines reflecting note semantic density across your vault.
- 🏷️ **Intelligent Mountain Peak Detection**: Automatically identifies semantic summits using localized non-maximum suppression (NMS) and synthesizes domain labels via LLM (e.g., DeepSeek, OpenAI, Ollama).
- 🎨 **7 Handcrafted Aesthetic Themes**:
  - **宋代青绿山水 (Shanshui)**: Traditional Chinese landscape painting with mineral pigments and red seal badges.
  - **普鲁士工程蓝图 (Blueprint)**: Technical precision cyanotype with technical crosshair markers.
  - **深空韦伯星云 (Stellar)**: Deep cosmic nebula survey aesthetic.
  - **瑞士国际主义 (Swiss Minimal)**: Helvetica-inspired modernist layout with clean typographic boxes.
  - **和纸苔藓若竹 (Matcha & Bamboo)**: Zen garden atmosphere with subtle matcha green gradients.
  - **文艺复兴手稿 (Da Vinci)**: Renaissance parchment with vintage sepia tonality.
  - **现代极夜深蓝 (Contemporary)**: Sleek synthetic radar dark mode.
- ⚡ **Flexible Embedding Engines**:
  - **OpenAI-Compatible API**: Seamlessly connect to Ollama (local), SiliconFlow, DeepSeek, or OpenAI endpoints.
  - **Local ONNX Model**: Run fully offline using local ONNX embeddings (e.g., `bge-m3`, `jina-embeddings-v2`).
- 🌐 **Interactive Standalone HTML Export**: Export a self-contained, publication-ready interactive HTML file that can be opened in any modern browser without Obsidian running.
- 🔒 **Zero Telemetry & Strict Privacy**: All processing runs locally within your vault or connects solely to your designated API endpoint. No external user tracking or telemetry.

---

## 🚀 Installation

### From Community Plugins (Recommended)
1. Open **Obsidian Settings** → **Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse** and search for `Knowledge Topography`.
4. Click **Install**, then **Enable**.

### Via BRAT
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian-4rw-brat).
2. Add beta plugin: `Joffoo/obsidian-knowledge-topography`.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/Joffoo/obsidian-knowledge-topography/releases).
2. In your vault, navigate to `.obsidian/plugins/` and create a folder named `knowledge-topography`.
3. Place the downloaded files inside `.obsidian/plugins/knowledge-topography/`.
4. Reload Obsidian and enable the plugin in settings.

---

## 🛠️ Getting Started

1. Click the **Map icon** on the left ribbon or run the command `打开语义知识地图` (`Open Knowledge Topography`).
2. If this is your first time, go to **Plugin Settings**:
   - **Embedding Engine**: Choose `OpenAI 兼容 API` (e.g. Ollama `http://localhost:11434/v1` or cloud providers) or `本地 ONNX 模型文件`.
   - **LLM Synthesis**: (Optional) Provide your LLM endpoint to automatically label the detected peaks.
3. Click **立即构建地图** (Build Map).
4. Enjoy exploring your knowledge landscape! You can click on any note to open it directly in Obsidian.

---

## ⚙️ Requirements & Compatibility

- **Obsidian**: v1.5.0 or higher.
- **Platform**: Desktop only (macOS, Windows, Linux). Requires desktop environment for spatial matrix computations and local file rendering.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
