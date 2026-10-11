import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { HtmlMapGenerator } from "../services/htmlGenerator";
import KnowledgeMapPlugin from "../main";

export const KNOWLEDGE_MAP_VIEW_TYPE = "knowledge-map-view";

export class KnowledgeMapView extends ItemView {
	private plugin: KnowledgeMapPlugin;
	private container: HTMLElement;
	private iframeEl: HTMLIFrameElement;
	private progressEl: HTMLElement;
	private emptyEl: HTMLElement;
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: KnowledgeMapPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return KNOWLEDGE_MAP_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "语义知识地图";
	}

	getIcon(): string {
		return "map";
	}

	async onOpen(): Promise<void> {
		this.container = this.contentEl;
		this.container.empty();
		this.container.addClass("knowledge-map-container");

		// Header Actions (Native Obsidian Icons)
		this.addAction("refresh-cw", "重新生成知识地图", async () => {
			await this.plugin.generateMap();
		});

		this.addAction("external-link", "在外部浏览器中打开 HTML", () => {
			this.openInBrowser();
		});

		// 1. Create Iframe for interactive HTML
		this.iframeEl = this.container.createEl("iframe", {
			cls: "knowledge-map-iframe",
		});
		this.iframeEl.setAttribute(
			"sandbox",
			"allow-scripts allow-same-origin allow-popups allow-modals allow-top-navigation"
		);

		// 2. Create Progress Overlay
		this.progressEl = this.container.createDiv({
			cls: "knowledge-map-progress-overlay",
		});
		this.progressEl.style.display = "none";

		// 3. Create Empty State Container
		this.emptyEl = this.container.createDiv({
			cls: "knowledge-map-empty-state",
		});
		this.renderEmptyStateContent();

		// 4. Setup Event Listeners
		this.setupEventListeners();

		// 5. Initial Render
		await this.checkAndRender();
	}

	async onClose(): Promise<void> {
		if (this.messageHandler) {
			window.removeEventListener("message", this.messageHandler);
			this.messageHandler = null;
		}
		this.container.empty();
	}

	private setupEventListeners(): void {
		this.messageHandler = (event: MessageEvent) => {
			if (!event.data) return;
			if (event.data.type === "km_open_note" && event.data.url) {
				try {
					let decodedPath = "";
					try {
						const urlObj = new URL(event.data.url);
						const fileParam = urlObj.searchParams.get("file");
						if (fileParam) decodedPath = decodeURIComponent(fileParam);
					} catch (urlErr) {
						const match = event.data.url.match(/file=([^&]+)/);
						if (match) decodedPath = decodeURIComponent(match[1]);
					}

					if (decodedPath) {
						this.app.workspace.openLinkText(decodedPath, "", false);
						new Notice(`已打开笔记: ${decodedPath.split("/").pop()}`);
					}
				} catch (e) {
					console.warn("[Knowledge Map] 打开笔记失败:", e);
				}
			} else if (event.data.type === "km_theme_change" && event.data.theme) {
				this.plugin.settings.currentTheme = event.data.theme;
				this.plugin.saveSettings();
			}
		};

		window.addEventListener("message", this.messageHandler);
	}

	showProgress(message: string, current: number, total: number, stageName?: string): void {
		this.hideEmptyState();
		this.progressEl.style.display = "flex";
		const percent = total > 0 ? Math.round((current / total) * 100) : 0;
		const stageLabel = stageName ? `<div class="knowledge-map-progress-stage">${stageName}</div>` : "";
		this.progressEl.innerHTML = `
			<div class="knowledge-map-progress-box">
				<div class="knowledge-map-spinner"></div>
				${stageLabel}
				<div class="knowledge-map-progress-text">${message}</div>
				${
					total > 0
						? `<div class="knowledge-map-progress-bar"><div class="knowledge-map-progress-fill" style="width: ${percent}%;"></div></div>
						   <div class="knowledge-map-progress-meta"><span>${current} / ${total} 篇</span><span>${percent}%</span></div>`
						: ""
				}
				<button class="knowledge-map-cancel-btn" id="km-cancel-task">取消任务</button>
			</div>
		`;

		const cancelBtn = this.progressEl.querySelector("#km-cancel-task");
		cancelBtn?.addEventListener("click", () => {
			this.plugin.cancelGeneration();
		});
	}

	hideProgress(): void {
		this.progressEl.style.display = "none";
	}

	showError(message: string): void {
		this.hideProgress();
		this.emptyEl.style.display = "flex";
		this.emptyEl.innerHTML = `
			<div class="knowledge-map-empty-content">
				<div class="knowledge-map-empty-icon">⚠️</div>
				<h3 style="color: var(--text-error);">生成遇到问题</h3>
				<p style="white-space: pre-wrap; font-size: 12px; color: var(--text-muted); text-align: left; max-height: 160px; overflow-y: auto; background: var(--background-primary); padding: 10px; border-radius: 6px;">${message}</p>
				<button class="knowledge-map-primary-btn" id="km-retry-scan">重新尝试</button>
			</div>
		`;
		const btn = this.emptyEl.querySelector("#km-retry-scan");
		btn?.addEventListener("click", async () => {
			await this.plugin.generateMap();
		});
	}

	private renderEmptyStateContent(): void {
		this.emptyEl.innerHTML = `
			<div class="knowledge-map-empty-content">
				<div class="knowledge-map-empty-icon">🗺️</div>
				<h3>尚未生成知识地貌</h3>
				<p>点击下方按钮，开始扫描笔记并构建交互式语义地貌地图。</p>
				<button class="knowledge-map-primary-btn" id="km-start-scan">立即构建地图</button>
			</div>
		`;

		const btn = this.emptyEl.querySelector("#km-start-scan");
		btn?.addEventListener("click", async () => {
			await this.plugin.generateMap();
		});
	}

	showEmptyState(): void {
		this.renderEmptyStateContent();
		this.emptyEl.style.display = "flex";
	}

	hideEmptyState(): void {
		this.emptyEl.style.display = "none";
	}

	private async checkAndRender(): Promise<void> {
		const mapData = this.plugin.getMapData();
		if (mapData) {
			this.hideEmptyState();
			await this.render();
		} else if (!this.plugin.isGenerating) {
			this.showEmptyState();
		}
	}

	async render(): Promise<void> {
		const mapData = this.plugin.getMapData();
		if (!mapData) return;

		const pluginDir = this.plugin.manifest.dir || ".obsidian/plugins/knowledge-topography";
		const plotlyPath = `${pluginDir}/plotly.min.js`;
		let localPlotlyUrl: string | null = null;
		if (await this.app.vault.adapter.exists(plotlyPath)) {
			localPlotlyUrl = this.app.vault.adapter.getResourcePath(plotlyPath);
		}

		const html = HtmlMapGenerator.generate({
			vaultName: this.app.vault.getName(),
			initialStyle: this.plugin.settings.currentTheme,
			mapData: mapData,
			localPlotlyUrl: localPlotlyUrl,
		});

		this.iframeEl.srcdoc = html;
	}

	openInBrowser(): void {
		const pluginDir = this.plugin.manifest.dir || ".obsidian/plugins/knowledge-topography";
		const htmlPath = `${pluginDir}/knowledge_map.html`;
		const vaultAdapter = this.app.vault.adapter as any;
		const basePath = vaultAdapter.basePath || (vaultAdapter.getBasePath ? vaultAdapter.getBasePath() : "");
		if (basePath) {
			const fullPath = `${basePath}/${htmlPath}`.replace(/\\/g, "/");
			window.open(`file:///${fullPath}`);
			new Notice("已在浏览器中打开知识地图 HTML。");
		}
	}
}
