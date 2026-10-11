import { ThemeConfig } from "../types";

export const THEMES: Record<string, ThemeConfig> = {
	shanshui: {
		id: "shanshui",
		name: "宋代青绿山水 (Shanshui)",
		bgColor: "#ECE7DE",
		inkColor: "#1C2321",
		secondaryColor: "#5C6764",
		accentColor: "#9E2A2B",
		contourLevels: 24,
		contourAlpha: 0.65,
		contourLineAlpha: 0.35,
		contourLineWidth: 0.45,
		cmapColors: ["#ECE7DE", "#A3C1AD", "#5B8A72", "#235789", "#1C2321"],
		plotlyColorscale: [
			[0.0, "rgba(236, 231, 222, 0.0)"],
			[0.12, "rgba(217, 226, 236, 0.3)"],
			[0.35, "rgba(163, 193, 173, 0.45)"],
			[0.65, "rgba(91, 138, 114, 0.6)"],
			[0.85, "rgba(35, 87, 137, 0.75)"],
			[1.0, "rgba(28, 35, 33, 0.85)"]
		],
		scatterPalette: [
			"#9E2A2B", "#235789", "#5B8A72", "#D4A373", "#774936",
			"#3A5A40", "#6A4C93", "#1982C4", "#8AC926", "#FF595E",
			"#C57B57", "#463F3A", "#2E4057", "#9381FF", "#B8833B"
		],
		scatterEdgeColor: "#1C2321",
		fontFamily: "'Songti SC', 'STSong', 'Noto Serif SC', 'SimSun', serif",
		peakMarkers: ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"],
		peakBadgeType: "stamp",
		brandTitleFormat: "{vault_name} · 知识千里江山图",
		brandSubtitle: "高维语义叠嶂 · 文人界画图卷",
		htmlCustomCss: `
			#brand {
				letter-spacing: 8px;
				font-family: 'Songti SC', 'STSong', 'SimSun', serif;
				font-weight: 500;
				color: rgba(28, 35, 33, 0.7);
			}
			.stamp-box {
				border: 1.5px solid #9E2A2B;
				color: #9E2A2B;
				padding: 2px 6px;
				font-weight: bold;
				border-radius: 2px;
				background: rgba(236, 231, 222, 0.85);
			}
		`,
		isDark: false,
	},
	blueprint: {
		id: "blueprint",
		name: "普鲁士工程蓝图 (Blueprint)",
		bgColor: "#0A192F",
		inkColor: "#E2F1FF",
		secondaryColor: "#64B5F6",
		accentColor: "#00F0FF",
		contourLevels: 22,
		contourAlpha: 0.7,
		contourLineAlpha: 0.45,
		contourLineWidth: 0.5,
		cmapColors: ["#071526", "#133E68", "#0E7490", "#06B6D4", "#E0F2FE"],
		plotlyColorscale: [
			[0.0, "rgba(10, 25, 47, 0.0)"],
			[0.15, "rgba(19, 62, 104, 0.25)"],
			[0.4, "rgba(14, 116, 144, 0.5)"],
			[0.7, "rgba(6, 182, 212, 0.7)"],
			[1.0, "rgba(224, 242, 254, 0.9)"]
		],
		scatterPalette: [
			"#00F0FF", "#38BDF8", "#34D399", "#FBBF24", "#F472B6",
			"#A78BFA", "#FB7185", "#60A5FA", "#2DD4BF", "#FDE047",
			"#E2E8F0", "#818CF8", "#C084FC", "#4ADE80", "#F87171"
		],
		scatterEdgeColor: "#E2F1FF",
		fontFamily: "'JetBrains Mono', 'SF Mono', 'Consolas', monospace",
		peakMarkers: [
			"SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05",
			"SEC-06", "SEC-07", "SEC-08", "SEC-09", "SEC-10"
		],
		peakBadgeType: "crosshair",
		brandTitleFormat: "{vault_name} // SYSTEM SCHEMATIC",
		brandSubtitle: "TOPOLOGICAL DENSITY MAP · SPECIFICATION V2.0",
		htmlCustomCss: `
			body::before {
				content: "";
				position: absolute;
				top: 0; left: 0; width: 100vw; height: 100vh;
				background-image: 
					linear-gradient(rgba(226, 241, 255, 0.03) 1px, transparent 1px),
					linear-gradient(90deg, rgba(226, 241, 255, 0.03) 1px, transparent 1px);
				background-size: 30px 30px;
				pointer-events: none;
				z-index: 10;
			}
			#brand {
				letter-spacing: 6px;
				font-family: 'JetBrains Mono', monospace;
				font-size: 13px;
				color: #64B5F6;
				opacity: 0.85;
			}
		`,
		hasGridPattern: true,
		isDark: true,
	},
	stellar: {
		id: "stellar",
		name: "深空韦伯星云 (Stellar)",
		bgColor: "#040208",
		inkColor: "#F3E8FF",
		secondaryColor: "#C084FC",
		accentColor: "#F43F5E",
		contourLevels: 24,
		contourAlpha: 0.7,
		contourLineAlpha: 0.3,
		contourLineWidth: 0.4,
		cmapColors: ["#0A0612", "#3B0764", "#831843", "#DB2777", "#FEF08A"],
		plotlyColorscale: [
			[0.0, "rgba(4, 2, 8, 0.0)"],
			[0.15, "rgba(59, 7, 100, 0.25)"],
			[0.45, "rgba(131, 24, 67, 0.5)"],
			[0.75, "rgba(219, 39, 119, 0.7)"],
			[1.0, "rgba(254, 240, 138, 0.9)"]
		],
		scatterPalette: [
			"#38BDF8", "#818CF8", "#E879F9", "#F43F5E", "#FB923C",
			"#FDE047", "#A78BFA", "#2DD4BF", "#4ADE80", "#F472B6",
			"#E0E7FF", "#C084FC", "#FB7185", "#34D399", "#60A5FA"
		],
		scatterEdgeColor: "#FFFFFF",
		fontFamily: "'Inter', 'Space Grotesk', -apple-system, sans-serif",
		peakMarkers: [
			"α-ORI", "β-CYG", "γ-CAS", "δ-SCO", "ε-PEG",
			"ζ-TAU", "η-UMA", "θ-AUR", "ι-LEO", "κ-AQL"
		],
		peakBadgeType: "star",
		brandTitleFormat: "{vault_name} // CELESTIAL DEEP FIELD",
		brandSubtitle: "INTERSTELLAR SEMANTIC NEBULA SURVEY",
		htmlCustomCss: `
			#brand {
				letter-spacing: 14px;
				font-family: 'Inter', sans-serif;
				font-weight: 200;
				color: #C084FC;
				opacity: 0.75;
				text-shadow: 0 0 12px rgba(192, 132, 252, 0.4);
			}
		`,
		isDark: true,
	},
	swiss: {
		id: "swiss",
		name: "瑞士国际主义 (Swiss Minimal)",
		bgColor: "#F8F8F8",
		inkColor: "#111111",
		secondaryColor: "#555555",
		accentColor: "#E60000",
		contourLevels: 20,
		contourAlpha: 0.65,
		contourLineAlpha: 0.4,
		contourLineWidth: 0.6,
		cmapColors: ["#EAEAEA", "#C4C4C4", "#888888", "#383838", "#111111"],
		plotlyColorscale: [
			[0.0, "rgba(248, 248, 248, 0.0)"],
			[0.15, "rgba(220, 220, 220, 0.3)"],
			[0.4, "rgba(160, 160, 160, 0.5)"],
			[0.75, "rgba(80, 80, 80, 0.7)"],
			[1.0, "rgba(17, 17, 17, 0.85)"]
		],
		scatterPalette: [
			"#E60000", "#111111", "#4A4A4A", "#737373", "#999999",
			"#262626", "#B30000", "#D63031", "#595959", "#333333",
			"#8C8C8C", "#A6A6A6", "#1A1A1A", "#FF3838", "#666666"
		],
		scatterEdgeColor: "#111111",
		fontFamily: "'Helvetica Neue', Arial, 'Inter', -apple-system, sans-serif",
		peakMarkers: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],
		peakBadgeType: "swiss_box",
		brandTitleFormat: "{vault_name} · KARTOGRAPHIE",
		brandSubtitle: "INTERNATIONALE TYPOGRAFIE & ORDNUNG",
		htmlCustomCss: `
			#brand {
				letter-spacing: 5px;
				font-family: 'Helvetica Neue', Arial, sans-serif;
				font-weight: 800;
				color: #111111;
				border-left: 3px solid #E60000;
				padding-left: 12px;
				opacity: 0.9;
			}
		`,
		isDark: false,
	},
	matcha: {
		id: "matcha",
		name: "和纸苔藓若竹 (Matcha & Bamboo)",
		bgColor: "#F6F4EB",
		inkColor: "#243328",
		secondaryColor: "#4E6E58",
		accentColor: "#B86B35",
		contourLevels: 22,
		contourAlpha: 0.65,
		contourLineAlpha: 0.35,
		contourLineWidth: 0.45,
		cmapColors: ["#E2E7E1", "#A3B899", "#668067", "#344E41", "#1A2E22"],
		plotlyColorscale: [
			[0.0, "rgba(246, 244, 235, 0.0)"],
			[0.15, "rgba(226, 231, 225, 0.3)"],
			[0.4, "rgba(163, 184, 153, 0.45)"],
			[0.7, "rgba(102, 128, 103, 0.65)"],
			[1.0, "rgba(36, 51, 40, 0.85)"]
		],
		scatterPalette: [
			"#344E41", "#588157", "#A3B899", "#B86B35", "#6B705C",
			"#A5A58D", "#DDA15E", "#BC6C25", "#283618", "#606C38",
			"#839788", "#EEE2DF", "#735D78", "#B388EB", "#4A5759"
		],
		scatterEdgeColor: "#243328",
		fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', 'STSong', 'Noto Serif SC', serif",
		peakMarkers: ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"],
		peakBadgeType: "zen_circle",
		brandTitleFormat: "{vault_name} · 知識の庭園",
		brandSubtitle: "ZEN GARDEN TOPOGRAPHY · 苔庭地勢図",
		htmlCustomCss: `
			#brand {
				letter-spacing: 8px;
				font-family: 'Yu Mincho', 'STSong', serif;
				font-weight: 400;
				color: #243328;
				opacity: 0.8;
			}
		`,
		isDark: false,
	},
	davinci: {
		id: "davinci",
		name: "文艺复兴手稿 (Da Vinci)",
		bgColor: "#F4ECD8",
		inkColor: "#4E342E",
		secondaryColor: "#8C6D62",
		accentColor: "#966432",
		contourLevels: 20,
		contourAlpha: 0.6,
		contourLineAlpha: 0.35,
		contourLineWidth: 0.5,
		cmapColors: ["#F4ECD8", "#E2D3B3", "#C9A96E", "#8C5828", "#4E342E"],
		plotlyColorscale: [
			[0.0, "rgba(244, 236, 216, 0.0)"],
			[0.1, "rgba(208, 208, 230, 0.25)"],
			[0.35, "rgba(230, 208, 150, 0.45)"],
			[0.65, "rgba(150, 100, 50, 0.55)"],
			[1.0, "rgba(78, 52, 46, 0.75)"]
		],
		scatterPalette: [
			"#8B4513", "#A0522D", "#CD853F", "#D2691E", "#B8860B",
			"#556B2F", "#6B8E23", "#4682B4", "#5F9EA0", "#483D8B",
			"#8FBC8F", "#BC8F8F", "#708090", "#2F4F4F", "#9932CC"
		],
		scatterEdgeColor: "none",
		fontFamily: "'Times New Roman', 'Baskerville', 'STSong', serif",
		peakMarkers: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"],
		peakBadgeType: "roman_circle",
		brandTitleFormat: "{vault_name} CARTOGRAPHY",
		brandSubtitle: "RENAISSANCE CODEX & TOPOLOGY",
		htmlCustomCss: `
			#brand {
				letter-spacing: 10px;
				font-family: 'Times New Roman', 'STSong', serif;
				text-transform: uppercase;
				opacity: 0.7;
			}
		`,
		isDark: false,
	},
	contemporary: {
		id: "contemporary",
		name: "现代极夜深蓝 (Contemporary)",
		bgColor: "#050505",
		inkColor: "#FFFFFF",
		secondaryColor: "#94A3B8",
		accentColor: "#00F0FF",
		contourLevels: 20,
		contourAlpha: 0.65,
		contourLineAlpha: 0.25,
		contourLineWidth: 0.5,
		cmapColors: ["#0A0A0A", "#007AFF", "#00FFFF"],
		plotlyColorscale: [
			[0.0, "rgba(5, 5, 5, 0.0)"],
			[0.15, "rgba(10, 30, 80, 0.2)"],
			[0.4, "rgba(0, 100, 220, 0.45)"],
			[0.75, "rgba(0, 180, 255, 0.65)"],
			[1.0, "rgba(0, 255, 255, 0.85)"]
		],
		scatterPalette: [
			"#38BDF8", "#818CF8", "#C084FC", "#F472B6", "#FB7185",
			"#34D399", "#4ADE80", "#A3E635", "#FACC15", "#FB923C",
			"#2DD4BF", "#60A5FA", "#A78BFA", "#E879F9", "#F43F5E"
		],
		scatterEdgeColor: "#FFFFFF",
		fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
		peakMarkers: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],
		peakBadgeType: "hud_dot",
		brandTitleFormat: "{vault_name} CONTOUR",
		brandSubtitle: "SYNTHETIC RADAR & DENSITY ATLAS",
		htmlCustomCss: `
			#brand {
				letter-spacing: 12px;
				font-family: 'Inter', sans-serif;
				font-weight: 200;
				opacity: 0.6;
			}
		`,
		isDark: true,
	},
};

export function getTheme(id: string): ThemeConfig {
	return THEMES[id] || THEMES["shanshui"];
}
