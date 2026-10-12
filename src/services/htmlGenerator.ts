import { MapData, Point2D } from "../types";
import { THEMES, getTheme } from "./themes";

export interface HtmlGeneratorOptions {
	vaultName: string;
	initialStyle: string;
	mapData: MapData;
	localPlotlyUrl?: string | null;
}

export class HtmlMapGenerator {
	static generate(options: HtmlGeneratorOptions): string {
		const { vaultName, initialStyle, mapData, localPlotlyUrl } = options;
		const styleKey = THEMES[initialStyle] ? initialStyle : "shanshui";
		const theme = getTheme(styleKey);

		const isDark = theme.isDark ?? ["#050505", "#040208", "#0A192F", "#111111"].includes(theme.bgColor);
		const lineColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
		const legendBg = isDark ? "rgba(20, 20, 25, 0.7)" : "rgba(245, 245, 240, 0.85)";
		const hoverBg = isDark ? "rgba(15, 15, 20, 0.95)" : "rgba(255, 255, 255, 0.95)";
		const hoverText = isDark ? "#FFFFFF" : theme.inkColor;
		const hoverBorder = isDark ? theme.accentColor : theme.secondaryColor;

		// 1. Grid ranges
		const gridMin = mapData.gridBounds ? mapData.gridBounds[0] : -0.15;
		const gridMax = mapData.gridBounds ? mapData.gridBounds[1] : 1.15;
		const gridW = mapData.gridWidth || 100;
		const gridH = mapData.gridHeight || 100;

		const xRange: number[] = [];
		for (let i = 0; i < gridW; i++) {
			xRange.push(gridMin + (i / (gridW - 1)) * (gridMax - gridMin));
		}
		const yRange: number[] = [];
		for (let i = 0; i < gridH; i++) {
			yRange.push(gridMin + (i / (gridH - 1)) * (gridMax - gridMin));
		}

		// 2. Trace 0: Terrain Heatmap Contours (45 layers)
		const traces: any[] = [
			{
				type: "contour",
				z: mapData.densityGrid,
				x: xRange,
				y: yRange,
				colorscale: theme.plotlyColorscale,
				showscale: false,
				contours: { coloring: "heatmap", showlines: true },
				line: { width: 0.4, color: lineColor },
				ncontours: 45,
				hoverinfo: "skip",
			},
		];

		// 3. Dynamic Traces 1 .. N: Unique Folders Scatters
		const folderMap = new Map<string, Point2D[]>();
		for (const pt of mapData.points) {
			const f = pt.folder || "/";
			if (!folderMap.has(f)) folderMap.set(f, []);
			folderMap.get(f)!.push(pt);
		}
		const uniqueFolders = Array.from(folderMap.keys()).sort();
		const edgeColor = theme.scatterEdgeColor || "none";
		const markerLine =
			edgeColor === "none" ? { width: 0 } : { width: 0.6, color: edgeColor };

		for (let i = 0; i < uniqueFolders.length; i++) {
			const f = uniqueFolders[i];
			const pts = folderMap.get(f) || [];
			const color = theme.scatterPalette[i % theme.scatterPalette.length];

			traces.push({
				type: "scatter",
				x: pts.map((p) => p.x),
				y: pts.map((p) => p.y),
				mode: "markers",
				marker: {
					size: 6.5,
					color: color,
					opacity: 0.9,
					line: markerLine,
				},
				name: f,
				text: pts.map((p) => p.title),
				customdata: pts.map(
					(p) =>
						`obsidian://open?vault=${encodeURIComponent(
							vaultName
						)}&file=${encodeURIComponent(p.path)}`
				),
				hovertemplate:
					"<b>%{text}</b><br><span style='font-size:10px; color:#888;'>CLICK TO OPEN IN OBSIDIAN</span><extra></extra>",
			});
		}

		// 4. Peak Badges Traces N+1 .. N+M
		const markers = theme.peakMarkers || ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
		const badgeType = theme.peakBadgeType || "stamp";

		for (let i = 0; i < mapData.clusters.length; i++) {
			const c = mapData.clusters[i];
			const marker = markers[i % markers.length] || `${i + 1}`;
			const t = c.domain;
			let innerBadge = "";
			if (badgeType === "stamp") {
				innerBadge = `<span class='stamp-box'>${marker}</span>&nbsp;<span class='peak-domain-name' style='color:${theme.inkColor};'>${t}</span>`;
			} else if (badgeType === "crosshair") {
				innerBadge = `<span style='color:${theme.accentColor}; font-family:monospace; border:1px solid ${theme.accentColor}; padding:1px 4px; font-size:10px;'>${marker}</span>&nbsp;<span class='peak-domain-name' style='color:${theme.inkColor};'>${t}</span>`;
			} else if (badgeType === "star") {
				innerBadge = `<span style='color:${theme.accentColor}; text-shadow:0 0 8px ${theme.accentColor}; font-weight:bold;'>✦ ${marker}</span>&nbsp;<span class='peak-domain-name' style='color:${theme.inkColor};'>${t}</span>`;
			} else if (badgeType === "swiss_box") {
				innerBadge = `<span style='background:${theme.accentColor}; color:#fff; padding:1px 5px; font-weight:bold; font-size:10px; margin-right:4px;'>${marker}</span><span class='peak-domain-name' style='color:${theme.inkColor}; font-weight:bold;'>${t.toUpperCase()}</span>`;
			} else if (badgeType === "zen_circle") {
				innerBadge = `<span style='border:1px solid ${theme.secondaryColor}; border-radius:50%; padding:0 5px; color:${theme.secondaryColor}; font-size:10px;'>${marker}</span>&nbsp;<span class='peak-domain-name' style='color:${theme.inkColor};'>${t}</span>`;
			} else {
				innerBadge = `<span class='peak-domain-name' style='color:${theme.secondaryColor}; font-weight:bold;'>[${marker}] ${t.toUpperCase()}</span>`;
			}

			const fullText = `<span class='peak-pill-card' style='font-family:${theme.fontFamily};'>${innerBadge}</span>`;

			traces.push({
				type: "scatter",
				x: [c.x],
				y: [c.y],
				mode: "text",
				text: [fullText],
				textposition: "top center",
				hoverinfo: "skip",
				showlegend: false,
			});
		}

		// 5. Layout Configuration
		const layout = {
			paper_bgcolor: theme.bgColor,
			plot_bgcolor: theme.bgColor,
			xaxis: {
				showgrid: false,
				zeroline: false,
				showticklabels: false,
				range: [gridMin, gridMax],
			},
			yaxis: {
				showgrid: false,
				zeroline: false,
				showticklabels: false,
				range: [gridMin, gridMax],
			},
			showlegend: true,
			legend: {
				font: { color: theme.inkColor, size: 10, family: theme.fontFamily },
				bgcolor: legendBg,
				bordercolor: lineColor,
				borderwidth: 1,
				orientation: "h",
				yanchor: "bottom",
				y: 0.03,
				xanchor: "center",
				x: 0.5,
				itemsizing: "constant",
			},
			margin: { l: 0, r: 0, t: 0, b: 0 },
			clickmode: "event",
			dragmode: "pan",
			hoverlabel: {
				bgcolor: hoverBg,
				bordercolor: hoverBorder,
				font: { color: hoverText, size: 12, family: theme.fontFamily },
			},
			autosize: true,
		};

		// 6. Brand Titles
		const brandTitle = theme.brandTitleFormat.replace("{vault_name}", vaultName.toUpperCase());
		const brandSubtitle = theme.brandSubtitle || "";

		// 7. Theme options for selector
		const styleOptionsHtml = Object.entries(THEMES)
			.map(
				([k, v]) =>
					`<option value="${k}" ${k === styleKey ? "selected" : ""}>${v.name}</option>`
			)
			.join("");

		// 8. Runtime theme database
		const runtimeThemes: Record<string, any> = {};
		for (const [k, v] of Object.entries(THEMES)) {
			runtimeThemes[k] = {
				id: v.id,
				name: v.name,
				bg_color: v.bgColor,
				ink_color: v.inkColor,
				secondary_color: v.secondaryColor || v.inkColor,
				accent_color: v.accentColor || v.inkColor,
				plotly_colorscale: v.plotlyColorscale,
				scatter_palette: v.scatterPalette,
				scatter_edge_color: v.scatterEdgeColor || "none",
				font_family_web: v.fontFamily,
				peak_markers: v.peakMarkers,
				peak_badge_type: v.peakBadgeType,
				brand_title_format: v.brandTitleFormat,
				brand_subtitle: v.brandSubtitle || "",
				html_custom_css: v.htmlCustomCss || "",
			};
		}

		let plotlyScriptTag = "";
		if (localPlotlyUrl) {
			plotlyScriptTag = `
    <script src="${localPlotlyUrl}"></script>
    <script>
        if (typeof Plotly === 'undefined') {
            document.write('<script src="./plotly.min.js"><\\/script>');
        }
    </script>
    <script>
        if (typeof Plotly === 'undefined') {
            document.write('<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"><\\/script>');
        }
    </script>`;
		} else {
			plotlyScriptTag = `
    <script src="./plotly.min.js"></script>
    <script>
        if (typeof Plotly === 'undefined') {
            document.write('<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"><\\/script>');
        }
    </script>`;
		}

		const peaksDataJson = JSON.stringify(mapData.clusters.map((c) => ({ x: c.x, y: c.y })));
		const themesLabelsJson = JSON.stringify(mapData.clusters.map((c) => c.domain));
		const themesDataJson = JSON.stringify(runtimeThemes);
		const initialDataJson = JSON.stringify(traces);
		const initialLayoutJson = JSON.stringify(layout);
		const allPointsJson = JSON.stringify(
			mapData.points.map((p) => ({
				path: p.path,
				title: p.title,
				folder: p.folder,
				x: p.x,
				y: p.y,
				clusterId: p.clusterId,
			}))
		);
		const clustersSummaryJson = JSON.stringify(
			mapData.clusters.map((c) => ({
				id: c.id,
				domain: c.domain,
				x: c.x,
				y: c.y,
			}))
		);
		const gridBoundsJson = JSON.stringify(mapData.gridBounds || [-0.15, 1.15]);

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${vaultName} | Knowledge Topography</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;400;700&family=JetBrains+Mono:wght@300;500&family=Noto+Serif+SC:wght@300;600&family=Songti+SC&family=STSong&display=swap" rel="stylesheet">
    ${plotlyScriptTag}
    <style>
        body, html { 
            margin: 0; padding: 0; 
            width: 100%; height: 100%; 
            background-color: ${theme.bgColor}; 
            overflow: hidden; 
            position: relative;
            font-family: ${theme.fontFamily};
            transition: background-color 0.4s ease;
            user-select: none;
        }
        #main-stage { width: 100%; height: 100%; display: block; }
        .plotly-graph-div { width: 100% !important; height: 100% !important; }

        /* Top Left Brand Area (huashu-design) */
        #brand-container {
            position: absolute; 
            top: 32px; left: 40px;
            pointer-events: none; 
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 5px;
            transition: all 0.3s ease;
        }
        #brand {
            font-size: 16px;
            letter-spacing: 6px;
            color: ${theme.inkColor};
            font-weight: 600;
            transition: color 0.3s ease;
        }
        #brand-sub {
            font-size: 10px;
            letter-spacing: 3px;
            color: ${theme.secondaryColor};
            opacity: 0.75;
            text-transform: uppercase;
            transition: color 0.3s ease;
        }

        /* Top Right Style Switcher Capsule (huashu-design) */
        #style-switcher-capsule {
            position: absolute;
            top: 28px; right: 36px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${isDark ? "rgba(20, 20, 25, 0.7)" : "rgba(255, 255, 255, 0.85)"};
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)"};
            border-radius: 30px;
            padding: 5px 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
        }
        #style-switcher-capsule:hover {
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
            transform: translateY(-1px);
        }
        .capsule-btn {
            background: transparent;
            border: none;
            outline: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            padding: 2px 4px;
            opacity: 0.75;
            color: inherit;
            border-radius: 4px;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .capsule-btn:hover {
            opacity: 1;
            transform: scale(1.1);
        }
        .capsule-divider {
            width: 1px;
            height: 14px;
            background: ${isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)"};
            margin: 0 2px;
        }
        .capsule-icon {
            font-size: 14px;
            opacity: 0.7;
            user-select: none;
        }
        #style-select {
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background: transparent;
            border: none;
            outline: none;
            color: ${isDark ? "#FFFFFF" : theme.inkColor};
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            padding-right: 18px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='none' stroke='%23888888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 2px center;
            transition: color 0.3s ease;
        }
        #style-select option {
            background-color: #1A1A1A;
            color: #FFFFFF;
            font-size: 12px;
            padding: 8px;
        }

        .stamp-box {
            border: 1.5px solid ${theme.accentColor};
            color: ${theme.accentColor};
            padding: 1px 4px;
            font-weight: bold;
            border-radius: 2px;
            background: rgba(236, 231, 222, 0.85);
            font-size: 10px;
        }

        .peak-pill-card {
            display: inline-flex;
            align-items: center;
            background: ${isDark ? "rgba(18, 18, 24, 0.90)" : "rgba(252, 250, 244, 0.94)"};
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.14)"};
            border-radius: 20px;
            padding: 3px 10px 3px 8px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            transition: all 0.3s ease;
        }

        .peak-domain-name {
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 1.5px;
            margin-left: 2px;
            text-shadow: ${isDark ? "0 1px 4px rgba(0,0,0,0.8)" : "0 1px 2px rgba(255,255,255,0.8)"};
        }

        /* Radar Probe HUD Card */
        #radar-hud {
            position: absolute;
            bottom: 30px;
            left: 36px;
            z-index: 1000;
            max-width: 340px;
            background: ${isDark ? "rgba(18, 18, 24, 0.88)" : "rgba(255, 255, 255, 0.92)"};
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)"};
            border-radius: 16px;
            padding: 14px 18px;
            box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
            font-size: 12px;
            color: ${isDark ? "#E0E0E0" : theme.inkColor};
            display: none;
            flex-direction: column;
            gap: 10px;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateY(8px);
            opacity: 0;
            pointer-events: auto;
        }
        #radar-hud.active {
            display: flex;
            opacity: 1;
            transform: translateY(0);
        }
        .hud-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.5px;
            border-bottom: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)"};
            padding-bottom: 8px;
        }
        .hud-header-title {
            display: flex;
            align-items: center;
            gap: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .hud-close-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 14px;
            color: inherit;
            opacity: 0.6;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .hud-close-btn:hover {
            opacity: 1;
            background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"};
        }
        .hud-body {
            display: flex;
            flex-direction: column;
            gap: 6px;
            line-height: 1.5;
        }
        .hud-row {
            display: flex;
            align-items: baseline;
            gap: 6px;
        }
        .hud-label {
            font-size: 11px;
            opacity: 0.65;
            flex-shrink: 0;
        }
        .hud-value {
            font-weight: 600;
            color: ${theme.accentColor};
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .hud-neighbors-list {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .hud-neighbor-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"};
            border-radius: 6px;
            padding: 5px 8px;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.15s ease;
            text-decoration: none;
            color: inherit;
        }
        .hud-neighbor-item:hover {
            background: ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.07)"};
            transform: translateX(2px);
        }
        .hud-neighbor-title {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
            max-width: 220px;
        }
        .hud-neighbor-dist {
            font-size: 10px;
            opacity: 0.5;
            font-family: monospace;
            margin-left: 6px;
        }
    </style>
    <style id="theme-custom-style">
        ${theme.htmlCustomCss}
    </style>
</head>
<body>
    <div id="brand-container">
        <div id="brand">${brandTitle}</div>
        <div id="brand-sub">${brandSubtitle}</div>
    </div>

    <div id="style-switcher-capsule">
        <button id="reset-view-btn" class="capsule-btn" title="回归全貌视图 (Reset Overview)">⟲</button>
        <div class="capsule-divider"></div>
        <span class="capsule-icon">🧭</span>
        <select id="style-select" title="切换地貌视觉风格">
            ${styleOptionsHtml}
        </select>
    </div>

    <!-- Radar HUD Card -->
    <div id="radar-hud">
        <div class="hud-header">
            <div class="hud-header-title">
                <span>📍</span>
                <span id="hud-note-title">--</span>
            </div>
            <button class="hud-close-btn" id="hud-close" title="关闭探针卡片">✕</button>
        </div>
        <div class="hud-body">
            <div class="hud-row">
                <span class="hud-label">所属山峰:</span>
                <span class="hud-value" id="hud-peak-domain">--</span>
            </div>
            <div>
                <div class="hud-label" style="margin-bottom: 3px;">语义近邻:</div>
                <div class="hud-neighbors-list" id="hud-neighbors"></div>
            </div>
        </div>
    </div>

    <div id="main-stage">
        <div id="map-plot" class="plotly-graph-div"></div>
    </div>

    <script>
        const VAULT_NAME = ${JSON.stringify(vaultName)};
        const INITIAL_STYLE = ${JSON.stringify(styleKey)};
        const THEMES_DATA = ${themesDataJson};
        const PEAKS_DATA = ${peaksDataJson};
        const THEMES_LABELS = ${themesLabelsJson};
        const ALL_POINTS = ${allPointsJson};
        const CLUSTERS_DATA = ${clustersSummaryJson};
        const GRID_BOUNDS = ${gridBoundsJson};
        const UNIQUE_FOLDERS_COUNT = ${uniqueFolders.length};

        function applyTheme(styleKey) {
            const theme = THEMES_DATA[styleKey] || THEMES_DATA['shanshui'];
            const isDark = ['#050505', '#040208', '#0A192F', '#111111'].includes(theme.bg_color);

            // 1. Update body and typography
            document.body.style.backgroundColor = theme.bg_color;
            document.body.style.fontFamily = theme.font_family_web;

            // 2. Update brand typography
            const brand = document.getElementById('brand');
            const brandSub = document.getElementById('brand-sub');
            if (brand) {
                brand.textContent = theme.brand_title_format.replace('{vault_name}', VAULT_NAME.toUpperCase());
                brand.style.color = theme.ink_color;
                brand.style.fontFamily = theme.font_family_web;
            }
            if (brandSub) {
                brandSub.textContent = theme.brand_subtitle || '';
                brandSub.style.color = theme.secondary_color || theme.ink_color;
            }

            // 3. Update style switcher capsule appearance
            const capsule = document.getElementById('style-switcher-capsule');
            const selectEl = document.getElementById('style-select');
            if (capsule && selectEl) {
                capsule.style.background = isDark ? 'rgba(20, 20, 25, 0.7)' : 'rgba(255, 255, 255, 0.85)';
                capsule.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                selectEl.style.color = isDark ? '#FFFFFF' : theme.ink_color;
                const divider = capsule.querySelector('.capsule-divider');
                if (divider) divider.style.background = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
                const resetBtnEl = document.getElementById('reset-view-btn');
                if (resetBtnEl) resetBtnEl.style.color = isDark ? '#FFFFFF' : theme.ink_color;
            }

            // 4. Update dynamic custom CSS
            const customStyleEl = document.getElementById('theme-custom-style');
            if (customStyleEl) {
                customStyleEl.innerHTML = (theme.html_custom_css || '') + \`
                    .stamp-box {
                        border: 1.5px solid \${theme.accent_color};
                        color: \${theme.accent_color};
                        padding: 1px 4px;
                        font-weight: bold;
                        border-radius: 2px;
                        background: rgba(236, 231, 222, 0.85);
                        font-size: 10px;
                    }
                \`;
            }

            // 5. Update Plotly Layout and Traces
            const plotEl = document.getElementById('map-plot');
            if (!plotEl || !plotEl.data) return;

            const lineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
            const legendBg = isDark ? 'rgba(20, 20, 25, 0.7)' : 'rgba(245, 245, 240, 0.85)';
            const hoverBg = isDark ? 'rgba(15, 15, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)';
            const hoverText = isDark ? '#FFFFFF' : theme.ink_color;
            const hoverBorder = isDark ? theme.accent_color : (theme.secondary_color || theme.ink_color);

            // Update Layout
            plotEl.layout.paper_bgcolor = theme.bg_color;
            plotEl.layout.plot_bgcolor = theme.bg_color;
            if (plotEl.layout.legend) {
                plotEl.layout.legend.bgcolor = legendBg;
                plotEl.layout.legend.bordercolor = lineColor;
                if (plotEl.layout.legend.font) {
                    plotEl.layout.legend.font.color = theme.ink_color;
                    plotEl.layout.legend.font.family = theme.font_family_web;
                }
            }
            if (plotEl.layout.hoverlabel) {
                plotEl.layout.hoverlabel.bgcolor = hoverBg;
                plotEl.layout.hoverlabel.bordercolor = hoverBorder;
                if (plotEl.layout.hoverlabel.font) {
                    plotEl.layout.hoverlabel.font.color = hoverText;
                    plotEl.layout.hoverlabel.font.family = theme.font_family_web;
                }
            }

            // Update Trace 0 (Contour)
            if (plotEl.data[0]) {
                plotEl.data[0].colorscale = theme.plotly_colorscale;
                plotEl.data[0].line = { width: 0.4, color: lineColor };
            }

            // Update Traces 1 .. UNIQUE_FOLDERS_COUNT (Folder Scatters)
            const edgeColor = theme.scatter_edge_color || 'none';
            const markerLine = (edgeColor === 'none') ? { width: 0 } : { width: 0.6, color: edgeColor };
            
            for (let i = 0; i < UNIQUE_FOLDERS_COUNT; i++) {
                const traceIdx = 1 + i;
                if (plotEl.data[traceIdx] && plotEl.data[traceIdx].marker) {
                    const color = theme.scatter_palette[i % theme.scatter_palette.length];
                    plotEl.data[traceIdx].marker.color = color;
                    plotEl.data[traceIdx].marker.line = markerLine;
                }
            }

            // Update Peaks Annotations
            const markers = theme.peak_markers || ['I', 'II', 'III', 'IV', 'V'];
            const badgeType = theme.peak_badge_type || 'stamp';
            const peakStartIdx = 1 + UNIQUE_FOLDERS_COUNT;

            for (let i = 0; i < PEAKS_DATA.length; i++) {
                const traceIdx = peakStartIdx + i;
                if (plotEl.data[traceIdx]) {
                    const marker = markers[i % markers.length];
                    const t = THEMES_LABELS[i] || \`PEAK \${i+1}\`;
                    let innerBadge = '';

                    if (badgeType === 'stamp') {
                        innerBadge = \`<span class='stamp-box'>\${marker}</span>&nbsp;<span class='peak-domain-name' style='color:\${theme.ink_color};'>\${t}</span>\`;
                    } else if (badgeType === 'crosshair') {
                        innerBadge = \`<span style='color:\${theme.accent_color}; font-family:monospace; border:1px solid \${theme.accent_color}; padding:1px 4px; font-size:10px;'>\${marker}</span>&nbsp;<span class='peak-domain-name' style='color:\${theme.ink_color};'>\${t}</span>\`;
                    } else if (badgeType === 'star') {
                        innerBadge = \`<span style='color:\${theme.accent_color}; text-shadow:0 0 8px \${theme.accent_color}; font-weight:bold;'>✦ \${marker}</span>&nbsp;<span class='peak-domain-name' style='color:\${theme.ink_color};'>\${t}</span>\`;
                    } else if (badgeType === 'swiss_box') {
                        innerBadge = \`<span style='background:\${theme.accent_color}; color:#fff; padding:1px 5px; font-weight:bold; font-size:10px; margin-right:4px;'>\${marker}</span><span class='peak-domain-name' style='color:\${theme.ink_color}; font-weight:bold;'>\${t.toUpperCase()}</span>\`;
                    } else if (badgeType === 'zen_circle') {
                        innerBadge = \`<span style='border:1px solid \${theme.secondary_color}; border-radius:50%; padding:0 5px; color:\${theme.secondary_color}; font-size:10px;'>\${marker}</span>&nbsp;<span class='peak-domain-name' style='color:\${theme.ink_color};'>\${t}</span>\`;
                    } else {
                        innerBadge = \`<span class='peak-domain-name' style='color:\${theme.secondary_color}; font-weight:bold;'>[\${marker}] \${t.toUpperCase()}</span>\`;
                    }

                    const fullText = \`<span class='peak-pill-card' style='font-family:\${theme.font_family_web};'>\${innerBadge}</span>\`;
                    plotEl.data[traceIdx].text = [fullText];
                }
            }

            // Single atomic render transaction via Plotly.react
            Plotly.react(plotEl, plotEl.data, plotEl.layout);

            try {
                localStorage.setItem('obsidian_map_style', styleKey);
                window.parent.postMessage({ type: 'km_theme_change', theme: styleKey }, '*');
            } catch(e) {}
        }

        window.addEventListener('load', function() {
            const plotEl = document.getElementById('map-plot');
            const initialData = ${initialDataJson};
            const initialLayout = ${initialLayoutJson};

            Plotly.newPlot(plotEl, initialData, initialLayout, {
                displayModeBar: false,
                responsive: true
            }).then(function() {
                // Click note event binding
                plotEl.on('plotly_click', function(data) {
                    if (data && data.points && data.points[0] && data.points[0].customdata) {
                        const url = data.points[0].customdata;
                        try {
                            if (window.parent && window.parent !== window) {
                                window.parent.postMessage({ type: 'km_open_note', url: url }, '*');
                            } else {
                                window.location.href = url;
                            }
                        } catch(e) {
                            window.location.href = url;
                        }
                    }
                });

                // Style Switcher event binding
                const selectEl = document.getElementById('style-select');
                if (selectEl) {
                    selectEl.addEventListener('change', function(e) {
                        applyTheme(e.target.value);
                    });
                }

                // Restore saved theme
                let savedStyle = null;
                try { savedStyle = localStorage.getItem('obsidian_map_style'); } catch(e) {}
                if (savedStyle && THEMES_DATA[savedStyle] && savedStyle !== INITIAL_STYLE) {
                    if (selectEl) selectEl.value = savedStyle;
                    applyTheme(savedStyle);
                }

                // Close HUD handler
                const hudEl = document.getElementById('radar-hud');
                const hudCloseBtn = document.getElementById('hud-close');
                if (hudCloseBtn && hudEl) {
                    hudCloseBtn.addEventListener('click', function() {
                        hudEl.classList.remove('active');
                        // Remove radar probe trace if exists
                        removeRadarTrace(plotEl);
                    });
                }

                // Reset Overview Viewport (回归全貌视图)
                function resetOverviewView() {
                    if (!plotEl) return;
                    removeRadarTrace(plotEl);
                    if (hudEl) hudEl.classList.remove('active');
                    const bMin = GRID_BOUNDS[0];
                    const bMax = GRID_BOUNDS[1];
                    Plotly.relayout(plotEl, {
                        'xaxis.range': [bMin, bMax],
                        'yaxis.range': [bMin, bMax]
                    });
                }

                const resetBtn = document.getElementById('reset-view-btn');
                if (resetBtn) {
                    resetBtn.addEventListener('click', resetOverviewView);
                }

                // Double-click on blank stage to reset view
                plotEl.on('plotly_doubleclick', function() {
                    resetOverviewView();
                });

                // Handle Locate Note messages (from Obsidian active leaf change or command)
                window.addEventListener('message', function(event) {
                    const data = event.data;
                    if (!data || data.type !== 'km_locate_note' || !data.path) return;
                    locateNoteOnMap(data.path);
                });

                function removeRadarTrace(plotEl) {
                    if (!plotEl || !plotEl.data) return;
                    const existingIdx = plotEl.data.findIndex(t => t.name === '__radar_probe__');
                    if (existingIdx !== -1) {
                        Plotly.deleteTraces(plotEl, existingIdx);
                    }
                }

                function locateNoteOnMap(targetPath) {
                    if (!plotEl || !ALL_POINTS || ALL_POINTS.length === 0) return;
                    const cleanTarget = targetPath.split('\\\\').join('/');
                    const pt = ALL_POINTS.find(p => p.path.split('\\\\').join('/') === cleanTarget);
                    if (!pt) {
                        console.warn('[Knowledge Topography] Note not found on map:', targetPath);
                        return;
                    }

                    // 1. Pan Plotly camera with smooth range transition
                    const span = 0.28;
                    Plotly.relayout(plotEl, {
                        'xaxis.range': [pt.x - span, pt.x + span],
                        'yaxis.range': [pt.y - span, pt.y + span]
                    });

                    // 2. Add / Update Radar Probe Trace
                    removeRadarTrace(plotEl);
                    const currentStyleKey = (selectEl ? selectEl.value : null) || INITIAL_STYLE;
                    const curTheme = THEMES_DATA[currentStyleKey] || THEMES_DATA['shanshui'];
                    const accentColor = curTheme.accent_color || '#D9534F';

                    const radarTrace = {
                        name: '__radar_probe__',
                        type: 'scatter',
                        x: [pt.x, pt.x],
                        y: [pt.y, pt.y],
                        mode: 'markers',
                        showlegend: false,
                        hoverinfo: 'skip',
                        marker: {
                            size: [32, 12],
                            color: [accentColor, accentColor],
                            opacity: [0.35, 1.0],
                            line: {
                                width: [2.5, 2],
                                color: ['#FFFFFF', '#FFFFFF']
                            }
                        }
                    };
                    Plotly.addTraces(plotEl, radarTrace);

                    // 3. Find summit domain
                    let summitDomain = '未分类区域';
                    const cluster = CLUSTERS_DATA.find(c => c.id === pt.clusterId);
                    if (cluster && cluster.domain) {
                        summitDomain = cluster.domain;
                    }

                    // 4. Calculate Top-3 Nearest Semantic Neighbors
                    const neighbors = ALL_POINTS
                        .filter(p => p.path.split('\\\\').join('/') !== cleanTarget)
                        .map(p => {
                            const dx = p.x - pt.x;
                            const dy = p.y - pt.y;
                            return {
                                path: p.path,
                                title: p.title,
                                dist: Math.sqrt(dx * dx + dy * dy)
                            };
                        })
                        .sort((a, b) => a.dist - b.dist)
                        .slice(0, 3);

                    // 5. Update and Show Radar HUD
                    if (hudEl) {
                        const noteTitleEl = document.getElementById('hud-note-title');
                        const peakDomainEl = document.getElementById('hud-peak-domain');
                        const neighborsEl = document.getElementById('hud-neighbors');

                        if (noteTitleEl) noteTitleEl.textContent = pt.title || pt.path.split('/').pop();
                        if (peakDomainEl) {
                            peakDomainEl.textContent = summitDomain;
                            peakDomainEl.style.color = accentColor;
                        }

                        if (neighborsEl) {
                            neighborsEl.innerHTML = '';
                            neighbors.forEach(n => {
                                const item = document.createElement('a');
                                item.className = 'hud-neighbor-item';
                                const openUrl = 'obsidian://open?vault=' + encodeURIComponent(VAULT_NAME) + '&file=' + encodeURIComponent(n.path);
                                item.href = openUrl;
                                item.title = n.path;

                                const titleSpan = document.createElement('span');
                                titleSpan.className = 'hud-neighbor-title';
                                titleSpan.textContent = n.title;

                                const distSpan = document.createElement('span');
                                distSpan.className = 'hud-neighbor-dist';
                                const simPct = Math.max(10, Math.round((1 - n.dist / 0.5) * 100));
                                distSpan.textContent = '~' + simPct + '%';

                                item.appendChild(titleSpan);
                                item.appendChild(distSpan);

                                item.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    try {
                                        if (window.parent && window.parent !== window) {
                                            window.parent.postMessage({ type: 'km_open_note', url: openUrl }, '*');
                                        } else {
                                            window.location.href = openUrl;
                                        }
                                    } catch(err) {
                                        window.location.href = openUrl;
                                    }
                                });

                                neighborsEl.appendChild(item);
                            });
                        }

                        hudEl.classList.add('active');
                    }
                }
            });
        });
    </script>
</body>
</html>`;
	}
}
