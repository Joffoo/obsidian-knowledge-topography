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
		lang_desc: "选择插件显示的语言。",
		lang_auto: "自动跟随系统 (Auto)",
		lang_zh: "简体中文",
		lang_en: "English",

		// Section 1
		sec_engine: "测绘引擎",
		mode_name: "运行方式",
		mode_desc: "选择在本地设备运行或使用在线服务。",
		opt_local: "本地离线",
		opt_api: "在线服务",
		local_path_name: "模型路径",
		local_path_desc: "本地模型存放的文件夹完整路径。",
		local_path_holder: "如：D:/models/bge-m3",
		api_url_name: "服务地址",
		api_url_desc: "提供计算服务的网址，如 Ollama。",
		api_key_name: "访问密钥",
		api_key_desc: "服务商的 API Key，本地运行留空。",
		model_name: "模型名称",
		model_desc: "所选服务对应的模型代号。",

		// Section 2
		sec_peak: "山峰命名",
		sec_peak_desc: "用 AI 自动为各个知识山峰起名字。",
		llm_url_name: "服务地址",
		llm_url_desc: "用于山峰命名的 AI 接口网址。",
		llm_key_name: "访问密钥",
		llm_key_desc: "AI 服务的 API Key，本地可留空。",
		llm_model_name: "模型名称",
		llm_model_desc: "负责为山峰起名的对话模型代号。",
		test_name: "连接测试",
		test_desc: "检查 AI 服务是否可以正常连接。",
		test_btn: "测试连接",
		test_testing: "正在验证...",
		test_ok: "连接成功！模型响应: ",
		test_fail: "连接失败: ",

		// Section 3
		sec_scan: "收录范围",
		ignore_name: "排除目录",
		ignore_desc: "不用生成地图的文件夹，用逗号隔开。",
		ignore_holder: "如：Templates, Attachments",
		ignore_quick_add_name: "快速排除",
		ignore_quick_add_desc: "直接从库里选择要排除的文件夹。",
		ignore_quick_add_btn: "加入排除",
		ignore_added_notice: "已添加排除目录",
		ignore_already_exists: "已在排除列表中",
		sample_name: "读取字数",
		sample_desc: "每篇笔记前几百字参与测绘，推荐 600。",

		// Section 4
		sec_interaction: "动态交互",
		radar_toggle_name: "随选聚焦",
		radar_toggle_desc: "打开笔记时，地图自动找到并放大它。",
		time_slider_toggle_name: "时光演变",
		time_slider_toggle_desc: "在顶部展示时间轴，回放笔记生成历程。",
		time_field_name: "日期属性",
		time_field_desc: "填 date 等属性名，留空直接按创建时间。",

		// Section 5
		sec_data: "缓存数据",
		cache_name: "本地缓存",
		cache_desc: (n: number) => `已保存 ${n} 篇计算结果，改动时省时省力。`,
		clear_btn: "清空缓存",
		clear_notice: "已清空所有缓存，下次将完整重新计算。",

		// View & Commands
		ribbon_tooltip: "打开地图",
		cmd_open: "打开地图",
		cmd_rebuild: "重新测绘",
		cmd_locate: "定位笔记",
		notice_not_in_map: "当前笔记尚未收录于知识地貌中，请重新测绘地图。",
		hud_current_loc: "当前笔记",
		hud_peak_domain: "所在山脉",
		hud_neighbors: "相关笔记",
		empty_title: "尚未生成地貌",
		empty_desc: "轻点下方按钮，生成你的知识等高线地图。",
		btn_build: "生成地图",
		btn_cancel: "取消",
		err_title: "生成失败",
		btn_retry: "重新生成",
		notice_html_opened: "已在浏览器中打开知识地貌 HTML。",
		progress_unit: "篇",
		stage_scan: "读取笔记",
		stage_embed: "分析内容",
		stage_spatial: "绘制地势",
		stage_peaks: "山峰命名",

		// Search
		search_placeholder: "输入内容语义寻山...",
		search_btn: "搜索",
		search_searching: "正在理解并寻山...",
		search_no_results: "未探寻到相关知识山峰",
		search_not_built: "请先生成地貌图后再搜索",
		cmd_search: "在知识地貌中搜索",
		search_match: "匹配度",
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
		sec_engine: "Mapping Engine",
		mode_name: "Run Mode",
		mode_desc: "Run locally on device or use online service.",
		opt_local: "Local Offline",
		opt_api: "Online Service",
		local_path_name: "Model Path",
		local_path_desc: "Full path to the local model folder.",
		local_path_holder: "e.g. D:/models/bge-m3",
		api_url_name: "Server URL",
		api_url_desc: "Service endpoint URL, e.g. Ollama.",
		api_key_name: "API Key",
		api_key_desc: "API key. Leave blank for local Ollama.",
		model_name: "Model Name",
		model_desc: "Model identifier for the selected service.",

		// Section 2
		sec_peak: "Summit Naming",
		sec_peak_desc: "Use AI to name topographic summits.",
		llm_url_name: "Server URL",
		llm_url_desc: "API endpoint URL for summit naming.",
		llm_key_name: "API Key",
		llm_key_desc: "API key for the chat model.",
		llm_model_name: "Model Name",
		llm_model_desc: "Model identifier for summit naming.",
		test_name: "Test Link",
		test_desc: "Verify if the AI connection works.",
		test_btn: "Test Link",
		test_testing: "Verifying...",
		test_ok: "Connected! Model response: ",
		test_fail: "Connection failed: ",

		// Section 3
		sec_scan: "Included Scope",
		ignore_name: "Exclude Folders",
		ignore_desc: "Folders to skip, separated by commas.",
		ignore_holder: "e.g. Templates, Attachments",
		ignore_quick_add_name: "Quick Exclude",
		ignore_quick_add_desc: "Pick a folder from vault to exclude.",
		ignore_quick_add_btn: "Exclude",
		ignore_added_notice: "Added to excluded folders",
		ignore_already_exists: "is already in the list",
		sample_name: "Sample Length",
		sample_desc: "Characters sampled per note (recommended: 600).",

		// Section 4
		sec_interaction: "Dynamic Interaction",
		radar_toggle_name: "Focus on Note",
		radar_toggle_desc: "Automatically pan and focus map on active note.",
		time_slider_toggle_name: "Timeline Slider",
		time_slider_toggle_desc: "Show interactive timeline slider at top.",
		time_field_name: "Date Property",
		time_field_desc: "Frontmatter key (e.g. date). Empty = file creation time.",

		// Section 5
		sec_data: "Cached Data",
		cache_name: "Local Cache",
		cache_desc: (n: number) => `${n} notes cached. Skips re-computation.`,
		clear_btn: "Clear Cache",
		clear_notice: "Cleared all cache. Will re-analyze on next build.",

		// View & Commands
		ribbon_tooltip: "Open Map",
		cmd_open: "Open Map",
		cmd_rebuild: "Remap Topography",
		cmd_locate: "Locate Note",
		notice_not_in_map: "Note not found in the current topography map. Try rebuilding the map.",
		hud_current_loc: "Current Note",
		hud_peak_domain: "Summit Ridge",
		hud_neighbors: "Related Notes",
		empty_title: "Landscape Not Built",
		empty_desc: "Click below to render your notes as a topographic map.",
		btn_build: "Generate Map",
		btn_cancel: "Cancel",
		err_title: "Build Failed",
		btn_retry: "Try Again",
		notice_html_opened: "Opened topography HTML in browser.",
		progress_unit: "notes",
		stage_scan: "Reading Notes",
		stage_embed: "Analyzing Notes",
		stage_spatial: "Plotting Contours",
		stage_peaks: "Naming Summits",

		// Search
		search_placeholder: "Search landscape semantically...",
		search_btn: "Search",
		search_searching: "Searching terrain...",
		search_no_results: "No relevant summits found",
		search_not_built: "Please build map first",
		cmd_search: "Search in Knowledge Topography",
		search_match: "Match",
	},
};

export type TranslationMap = typeof STRINGS.zh;

export function t(mode: LocaleMode): TranslationMap {
	const locale = resolveLocale(mode);
	return STRINGS[locale] || STRINGS.en;
}
