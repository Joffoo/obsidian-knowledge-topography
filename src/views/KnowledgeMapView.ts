import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { HtmlMapGenerator } from "../services/htmlGenerator";
import { resolveNoteTimestamp } from "../services/indexer";
import KnowledgeMapPlugin from "../main";
import { t } from "../i18n";

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
		return t(this.plugin.settings.locale).settings_title;
	}

	getIcon(): string {
		return "map";
	}

	async onOpen(): Promise<void> {
		this.container = this.contentEl;
		this.container.empty();
		this.container.addClass("knowledge-map-container");

		const i18n = t(this.plugin.settings.locale);

		// Header Actions (Native Obsidian Icons)
		this.addAction("refresh-cw", i18n.cmd_rebuild, async () => {
			await this.plugin.generateMap();
		});

		this.addAction("external-link", this.plugin.settings.locale === "en" ? "Open in Browser" : "在浏览器中打开", () => {
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
			cls: "knowledge-map-progress-overlay km-hidden",
		});

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
			const data = event.data as Record<string, unknown> | null;
			if (!data) return;
			if (data.type === "km_open_note" && typeof data.url === "string") {
				try {
					let decodedPath = "";
					try {
						const urlObj = new URL(data.url);
						const fileParam = urlObj.searchParams.get("file");
						if (fileParam) decodedPath = decodeURIComponent(fileParam);
					} catch {
						const match = data.url.match(/file=([^&]+)/);
						if (match) decodedPath = decodeURIComponent(match[1]);
					}

					if (decodedPath) {
						void this.app.workspace.openLinkText(decodedPath, "", false);
						new Notice(`已打开笔记: ${decodedPath.split("/").pop() ?? ""}`);
					}
				} catch (err: unknown) {
					console.warn("[Knowledge Map] 打开笔记失败:", err);
				}
			} else if (data.type === "km_theme_change" && typeof data.theme === "string") {
				this.plugin.settings.currentTheme = data.theme;
				void this.plugin.saveSettings();
			}
		};

		window.addEventListener("message", this.messageHandler);
	}

	showProgress(message: string, current: number, total: number, stageName?: string): void {
		const i18n = t(this.plugin.settings.locale);
		this.hideEmptyState();
		this.progressEl.removeClass("km-hidden");
		this.progressEl.empty();

		const box = this.progressEl.createDiv({ cls: "knowledge-map-progress-box" });
		box.createDiv({ cls: "knowledge-map-spinner" });

		if (stageName) {
			box.createDiv({ cls: "knowledge-map-progress-stage", text: stageName });
		}

		box.createDiv({ cls: "knowledge-map-progress-text", text: message });

		if (total > 0) {
			const percent = Math.round((current / total) * 100);
			const bar = box.createDiv({ cls: "knowledge-map-progress-bar" });
			const fill = bar.createDiv({ cls: "knowledge-map-progress-fill" });
			fill.setCssStyles({ width: `${percent}%` });

			const meta = box.createDiv({ cls: "knowledge-map-progress-meta" });
			meta.createSpan({ text: `${current} / ${total} ${i18n.progress_unit}` });
			meta.createSpan({ text: `${percent}%` });
		}

		const cancelBtn = box.createEl("button", {
			cls: "knowledge-map-cancel-btn",
			text: i18n.btn_cancel,
		});
		cancelBtn.addEventListener("click", () => {
			this.plugin.cancelGeneration();
		});
	}

	hideProgress(): void {
		this.progressEl.addClass("km-hidden");
	}

	showError(message: string): void {
		const i18n = t(this.plugin.settings.locale);
		this.hideProgress();
		this.emptyEl.removeClass("km-hidden");
		this.emptyEl.empty();

		const content = this.emptyEl.createDiv({ cls: "knowledge-map-empty-content" });
		content.createDiv({ cls: "knowledge-map-empty-icon", text: "⚠️" });
		content.createEl("h3", { cls: "knowledge-map-error-title", text: i18n.err_title });
		content.createEl("p", { cls: "knowledge-map-error-msg", text: message });
		if (this.plugin.lastErrorStack) {
			const details = content.createEl("details", { cls: "knowledge-map-error-details" });
			details.createEl("summary", { text: "查看错误堆栈 (Error Stack)" });
			details.createEl("pre", { text: this.plugin.lastErrorStack, cls: "knowledge-map-error-pre" });
		}

		const retryBtn = content.createEl("button", {
			cls: "knowledge-map-primary-btn",
			text: i18n.btn_retry,
		});
		retryBtn.addEventListener("click", () => {
			void this.plugin.generateMap();
		});
	}

	private renderEmptyStateContent(): void {
		const i18n = t(this.plugin.settings.locale);
		this.emptyEl.empty();

		const content = this.emptyEl.createDiv({ cls: "knowledge-map-empty-content" });
		content.createDiv({ cls: "knowledge-map-empty-icon", text: "🗺️" });
		content.createEl("h3", { text: i18n.empty_title });
		content.createEl("p", { text: i18n.empty_desc });

		const btn = content.createEl("button", {
			cls: "knowledge-map-primary-btn",
			text: i18n.btn_build,
		});
		btn.addEventListener("click", () => {
			void this.plugin.generateMap();
		});
	}

	showEmptyState(): void {
		this.renderEmptyStateContent();
		this.emptyEl.removeClass("km-hidden");
	}

	hideEmptyState(): void {
		this.emptyEl.addClass("km-hidden");
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

		// Ensure accurate ctime using configured YAML field or universal ctime
		if (Array.isArray(mapData.points)) {
			for (const pt of mapData.points) {
				const file = this.app.vault.getAbstractFileByPath(pt.path);
				if (file instanceof TFile) {
					pt.ctime = resolveNoteTimestamp(this.app, file, this.plugin.settings.timeFrontmatterKey);
				} else if (!pt.ctime || pt.ctime <= 0) {
					pt.ctime = Date.now();
				}
			}
		}

		const pluginDir = this.plugin.manifest.dir ?? `${this.app.vault.configDir}/plugins/knowledge-topography`;
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
			showTimeSlider: this.plugin.settings.showTimeSlider,
		});

		this.iframeEl.srcdoc = html;
	}

	openInBrowser(): void {
		const pluginDir = this.plugin.manifest.dir ?? `${this.app.vault.configDir}/plugins/knowledge-topography`;
		const htmlPath = `${pluginDir}/knowledge_map.html`;
		const vaultAdapter = this.app.vault.adapter as { basePath?: string; getBasePath?: () => string };
		const basePath = vaultAdapter.basePath ?? (vaultAdapter.getBasePath ? vaultAdapter.getBasePath() : "");
		if (basePath) {
			const fullPath = `${basePath}/${htmlPath}`.replace(/\\/g, "/");
			window.open(`file:///${fullPath}`);
			new Notice(t(this.plugin.settings.locale).notice_html_opened);
		}
	}

	locateNote(path: string): boolean {
		if (!this.iframeEl || !this.iframeEl.contentWindow) return false;
		this.iframeEl.contentWindow.postMessage({ type: "km_locate_note", path }, "*");
		return true;
	}
}
