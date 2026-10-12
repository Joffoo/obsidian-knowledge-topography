import { getLanguage } from "obsidian";
import { LocaleMode } from "./types";

export function resolveLocale(mode: LocaleMode): "zh" | "en" {
	if (mode === "zh") return "zh";
	if (mode === "en") return "en";

	// Auto detection from Obsidian environment
	try {
		const lang = getLanguage();
		if (typeof lang === "string" && lang.toLowerCase().startsWith("zh")) {
			return "zh";
		}
	} catch {
		// Fallback
	}
	return "en";
}

export const STRINGS = {
	zh: {
		// Settings Tab
		settings_title: "知识地貌",
		lang_name: "界面语言",
		lang_desc: "选择后台与界面的显示语言。",
		lang_auto: "自动跟随系统 (Auto)",
		lang_zh: "简体中文",
		lang_en: "English",

		// Section 1
		sec_engine: "地貌计算",
		mode_name: "计算方式",
		mode_desc: "本地离线运算或在线云端服务。",
		opt_local: "本地模型 (完全离线)",
		opt_api: "在线接口 (兼容 OpenAI)",
		local_path_name: "模型目录",
		local_path_desc: "本地模型文件夹的完整路径。",
		local_path_holder: "如：D:/models/bge-m3",
		api_url_name: "接口地址",
		api_url_desc: "服务网址，如 Ollama 或云端服务。",
		api_key_name: "访问密钥",
		api_key_desc: "服务授权密钥，本地 Ollama 可留空。",
		model_name: "模型名称",
		model_desc: "指定用于计算地貌的模型标识。",

		// Section 2
		sec_peak: "山峰命名",
		sec_peak_desc: "用 AI 智能提炼各山峰的主题名称。",
		llm_url_name: "接口地址",
		llm_url_desc: "用于山峰命名的模型接口网址。",
		llm_key_name: "访问密钥",
		llm_key_desc: "对话模型的访问授权凭证。",
		llm_model_name: "模型名称",
		llm_model_desc: "负责提炼领域的对话模型标识。",
		test_name: "连通测试",
		test_desc: "轻点按钮验证配置是否可用。",
		test_btn: "测试连接",
		test_testing: "正在验证...",
		test_ok: "连接成功！模型响应: ",
		test_fail: "连接失败: ",

		// Section 3
		sec_scan: "扫描范围",
		ignore_name: "忽略目录",
		ignore_desc: "不参与构建的文件夹，用逗号分隔（如：Templates, Attachments）。",
		ignore_holder: "如：Templates, Attachments",
		ignore_quick_add_name: "快速添加库中目录",
		ignore_quick_add_desc: "从当前笔记库中选择文件夹并一键追加到排除名单。",
		ignore_quick_add_btn: "添加排除",
		ignore_added_notice: "已添加排除目录",
		ignore_already_exists: "已在排除列表中",
		sample_name: "采样字数",
		sample_desc: "每篇笔记前序采样字数，推荐 500–1000。字数越多语义越丰富，但计算耗时略增。",

		// Section 4
		sec_interaction: "交互联动",
		radar_toggle_name: "编辑跟随雷达探针",
		radar_toggle_desc: "在 Obsidian 中切换笔记时，地貌地图自动聚焦并点亮该笔记的位置与近邻。",

		// Section 5
		sec_data: "数据存储",
		cache_name: "已存数据",
		cache_desc: (n: number) => `已存 ${n} 篇笔记特征，更新免重复计算。`,
		clear_btn: "清空数据",
		clear_notice: "已清空所有数据。下次构建将完整重算。",

		// View & Commands
		ribbon_tooltip: "查看知识地貌",
		cmd_open: "查看知识地貌",
		cmd_rebuild: "重建知识地貌",
		cmd_locate: "在知识地貌中定位当前笔记",
		notice_not_in_map: "当前笔记尚未收录于知识地貌中，请重新构建地图。",
		hud_current_loc: "当前定位",
		hud_peak_domain: "所属山峰",
		hud_neighbors: "语义近邻",
		empty_title: "尚未绘制地貌",
		empty_desc: "轻点下方按钮，生成你的知识等高线地貌。",
		btn_build: "构建地貌",
		btn_cancel: "取消",
		err_title: "构建失败",
		btn_retry: "重新构建",
		notice_html_opened: "已在浏览器中打开知识地貌 HTML。",
		progress_unit: "篇",
		stage_scan: "扫描笔记",
		stage_embed: "地貌计算",
		stage_spatial: "地貌测绘",
		stage_peaks: "山峰命名",
	},
	en: {
		// Settings Tab
		settings_title: "Knowledge Topography",
		lang_name: "Language",
		lang_desc: "Select display language for settings and UI.",
		lang_auto: "Auto (System Default)",
		lang_zh: "简体中文 (Chinese)",
		lang_en: "English",

		// Section 1
		sec_engine: "Topography Engine",
		mode_name: "Engine Mode",
		mode_desc: "Local offline model or online cloud API.",
		opt_local: "Local Model (Offline)",
		opt_api: "Online API (OpenAI Compatible)",
		local_path_name: "Model Path",
		local_path_desc: "Folder path of your local model files.",
		local_path_holder: "e.g. D:/models/bge-m3",
		api_url_name: "Server URL",
		api_url_desc: "API endpoint, e.g. Ollama or cloud URL.",
		api_key_name: "API Key",
		api_key_desc: "Access token. Leave blank for Ollama.",
		model_name: "Model Name",
		model_desc: "Model identifier for mapping topography.",

		// Section 2
		sec_peak: "Peak Naming",
		sec_peak_desc: "Summarize summit themes using AI.",
		llm_url_name: "Server URL",
		llm_url_desc: "Model API endpoint for peak naming.",
		llm_key_name: "API Key",
		llm_key_desc: "Access token for the language model.",
		llm_model_name: "Model Name",
		llm_model_desc: "Chat model for domain summarization.",
		test_name: "Test Link",
		test_desc: "Click to verify if the model works.",
		test_btn: "Test Link",
		test_testing: "Verifying...",
		test_ok: "Connected! Model response: ",
		test_fail: "Connection failed: ",

		// Section 3
		sec_scan: "Scan Scope",
		ignore_name: "Ignore Folders",
		ignore_desc: "Folders to skip, separated by commas (e.g. Templates, Attachments).",
		ignore_holder: "e.g. Templates, Attachments",
		ignore_quick_add_name: "Quick Add from Vault",
		ignore_quick_add_desc: "Pick an existing folder from your vault to append to excluded list.",
		ignore_quick_add_btn: "Add",
		ignore_added_notice: "Added to excluded folders",
		ignore_already_exists: "is already in the list",
		sample_name: "Sample Size",
		sample_desc: "Characters sampled per note (recommended 500–1000). Higher values capture richer semantics.",

		// Section 4
		sec_interaction: "Interaction",
		radar_toggle_name: "Semantic Radar Probe",
		radar_toggle_desc: "Automatically pan and highlight the active note on the map as you switch notes in Obsidian.",

		// Section 5
		sec_data: "Data Storage",
		cache_name: "Saved Data",
		cache_desc: (n: number) => `${n} notes saved. Skips reprocessing.`,
		clear_btn: "Clear All",
		clear_notice: "Cleared all saved data. Will re-analyze on next build.",

		// View & Commands
		ribbon_tooltip: "Open Knowledge Topography",
		cmd_open: "Open Knowledge Topography",
		cmd_rebuild: "Rebuild Knowledge Topography",
		cmd_locate: "Locate Active Note in Topography",
		notice_not_in_map: "Note not found in the current topography map. Try rebuilding the map.",
		hud_current_loc: "Current Location",
		hud_peak_domain: "Summit",
		hud_neighbors: "Semantic Neighbors",
		empty_title: "Landscape Not Built",
		empty_desc: "Click below to render your notes as a topographic map.",
		btn_build: "Build Topography",
		btn_cancel: "Cancel",
		err_title: "Build Failed",
		btn_retry: "Try Again",
		notice_html_opened: "Opened topography HTML in browser.",
		progress_unit: "notes",
		stage_scan: "Scanning Notes",
		stage_embed: "Computing Topography",
		stage_spatial: "Topographic Mapping",
		stage_peaks: "Naming Summits",
	},
};

export type TranslationMap = typeof STRINGS.zh;

export function t(mode: LocaleMode): TranslationMap {
	const locale = resolveLocale(mode);
	return STRINGS[locale] || STRINGS.en;
}
