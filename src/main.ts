import { Plugin, Notice } from "obsidian";
import { DEFAULT_SETTINGS, KnowledgeMapSettings, MapData, NoteItem } from "./types";
import { KnowledgeMapSettingTab } from "./settings";
import { KnowledgeMapView, KNOWLEDGE_MAP_VIEW_TYPE } from "./views/KnowledgeMapView";
import { EmbeddingCacheManager } from "./services/cache";
import { VaultIndexer } from "./services/indexer";
import { EmbeddingService } from "./services/embedding";
import { LLMSynthesizer } from "./services/llm";
import { SpatialComputer } from "./services/spatial";
import { HtmlMapGenerator } from "./services/htmlGenerator";
import { t } from "./i18n";

export default class KnowledgeMapPlugin extends Plugin {
	settings: KnowledgeMapSettings;
	cacheManager: EmbeddingCacheManager;
	indexer: VaultIndexer;
	embeddingService: EmbeddingService;
	llmSynthesizer: LLMSynthesizer;
	spatialComputer: SpatialComputer;
	isGenerating = false;
	private mapData: MapData | null = null;
	private statusBarItem: HTMLElement | null = null;
	private stateFilePath: string;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.stateFilePath = `${this.manifest.dir}/map_state.json`;

		// Status bar item
		this.statusBarItem = this.addStatusBarItem();

		// 1. Initialize services
		this.cacheManager = new EmbeddingCacheManager(this.app, this);
		await this.cacheManager.load();
		await this.loadMapState();

		this.indexer = new VaultIndexer(this.app, this.settings);
		this.embeddingService = new EmbeddingService(this.app, this.settings);
		this.llmSynthesizer = new LLMSynthesizer(this.settings);
		this.spatialComputer = new SpatialComputer();

		// 2. Register Custom View
		this.registerView(
			KNOWLEDGE_MAP_VIEW_TYPE,
			(leaf) => new KnowledgeMapView(leaf, this)
		);

		// 3. Register Left Ribbon Icon
		this.addRibbonIcon("map", t(this.settings.locale).ribbon_tooltip, () => {
			void this.activateView();
		});

		// 4. Register Commands
		this.addCommand({
			id: "open-knowledge-map",
			name: t(this.settings.locale).cmd_open,
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "regenerate-knowledge-map",
			name: t(this.settings.locale).cmd_rebuild,
			callback: () => {
				void this.generateMap();
			},
		});

		// 5. Register Settings Tab
		this.addSettingTab(new KnowledgeMapSettingTab(this.app, this));
	}

	onunload(): void {
		// Do not detach leaves in onunload per official Obsidian review guidelines
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		if (this.indexer) this.indexer.updateSettings(this.settings);
		if (this.embeddingService) this.embeddingService.updateSettings(this.settings);
		if (this.llmSynthesizer) this.llmSynthesizer.updateSettings(this.settings);
	}

	async loadMapState(): Promise<void> {
		try {
			if (await this.app.vault.adapter.exists(this.stateFilePath)) {
				const content = await this.app.vault.adapter.read(this.stateFilePath);
				this.mapData = JSON.parse(content);
			}
		} catch (e) {
			console.warn("[Knowledge Map] 未能载入历史地图数据:", e);
		}
	}

	async saveMapState(): Promise<void> {
		if (!this.mapData) return;
		try {
			await this.app.vault.adapter.write(this.stateFilePath, JSON.stringify(this.mapData));
		} catch (e) {
			console.error("[Knowledge Map] 保存地图状态失败:", e);
		}
	}

	getMapData(): MapData | null {
		return this.mapData;
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE)[0];

		if (!leaf) {
			const rootLeaf = workspace.getLeaf("tab");
			if (rootLeaf) {
				await rootLeaf.setViewState({
					type: KNOWLEDGE_MAP_VIEW_TYPE,
					active: true,
				});
				leaf = rootLeaf;
			}
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	private getActiveView(): KnowledgeMapView | null {
		const leaves = this.app.workspace.getLeavesOfType(KNOWLEDGE_MAP_VIEW_TYPE);
		if (leaves.length > 0 && leaves[0].view instanceof KnowledgeMapView) {
			return leaves[0].view;
		}
		return null;
	}

	cancelGeneration(): void {
		this.embeddingService.cancel();
		this.isGenerating = false;
		const view = this.getActiveView();
		if (view) {
			view.hideProgress();
			if (!this.mapData) view.showEmptyState();
		}
		if (this.statusBarItem) this.statusBarItem.setText("");
		new Notice("已取消知识地图计算任务。");
	}

	async generateMap(): Promise<void> {
		const view = this.getActiveView();
		this.isGenerating = true;

		try {
			// Step 1: Scan Vault Notes
			if (this.statusBarItem) this.statusBarItem.setText("🗺️ 知识地图: 正在扫描笔记...");
			const notes = await this.indexer.scanNotes((curr, total, msg) => {
				if (view) view.showProgress(msg, curr, total, "阶段 1/4 · 笔记扫描");
				if (this.statusBarItem) this.statusBarItem.setText(`🗺️ 知识地图: 正在扫描笔记 (${curr}/${total})`);
			});
			if (notes.length < 3) {
				new Notice("有效笔记不足（至少需 3 篇），无法构建语义地貌图。");
				if (view) {
					view.hideProgress();
					view.showEmptyState();
				}
				if (this.statusBarItem) this.statusBarItem.setText("");
				return;
			}

			// Step 2: Identify missing embeddings (Incremental Cache)
			const notesToCompute: NoteItem[] = [];
			for (const note of notes) {
				if (!this.cacheManager.hasValid(note.path, note.mtime)) {
					notesToCompute.push(note);
				}
			}

			// Step 3: Compute Embeddings
			if (notesToCompute.length > 0) {
				const computedMap = await this.embeddingService.computeEmbeddings(
					notesToCompute,
					(curr, total, msg) => {
						if (view) view.showProgress(msg, curr, total, "阶段 2/4 · 向量提取与本地推理");
						if (this.statusBarItem) {
							this.statusBarItem.setText(`🗺️ 知识地图: 向量计算 (${curr}/${total})`);
						}
					}
				);

				for (const [path, vec] of computedMap.entries()) {
					const targetNote = notes.find((n) => n.path === path);
					if (targetNote) {
						this.cacheManager.set(path, {
							path,
							title: targetNote.title,
							folder: targetNote.folder,
							mtime: targetNote.mtime,
							vector: vec,
						});
					}
				}
				await this.cacheManager.save();
			}

			// Collect all valid embeddings with folder info
			const allCached = this.cacheManager.getAll().filter((c) =>
				notes.some((n) => n.path === c.path)
			).map((c) => {
				const n = notes.find((item) => item.path === c.path);
				return {
					...c,
					folder: n?.folder || c.folder || "/",
				};
			});

			if (allCached.length < 3) {
				throw new Error("计算后有效向量不足，请检查嵌入配置。");
			}

			// Step 4: Spatial Computation (UMAP + 2D KDE)
			if (this.statusBarItem) this.statusBarItem.setText("🗺️ 知识地图: 正在计算地貌等高线...");
			if (view) view.showProgress("正在进行 2D 自适应降维与 80 层地貌等高线拟合...", 80, 100, "阶段 3/4 · 空间拓扑与地貌计算");
			const mapData = this.spatialComputer.computeMapData(
				allCached,
				this.settings.contourLevels
			);

			// Step 5: LLM Domain Synthesis
			if (this.statusBarItem) this.statusBarItem.setText("🗺️ 知识地图: 正在提炼领域标签...");
			if (view) view.showProgress("正在由大模型分析并归纳各山峰领域标签...", 95, 100, "阶段 4/4 · 领域语义提炼");
			const clusterSamples = mapData.clusters.map((c) => ({
				clusterId: c.id,
				notesCount: c.notes.length,
				coreNotes: c.notes.slice(0, 10).map((n) => {
					const origin = notes.find((item) => item.path === n.path);
					return {
						title: n.title,
						tags: origin?.tags || [],
						snippet: origin?.contentSnippet || "",
					};
				}),
			}));

			const domainMap = await this.llmSynthesizer.synthesizeDomains(clusterSamples);
			for (const cluster of mapData.clusters) {
				if (domainMap.has(cluster.id)) {
					cluster.domain = domainMap.get(cluster.id)!;
				}
			}

			// Generate standalone HTML for disk export (using clean relative path ./plotly.min.js without app:// pollution)
			const pluginDir = this.manifest.dir || ".obsidian/plugins/knowledge-topography";
			const standaloneHtml = HtmlMapGenerator.generate({
				vaultName: this.app.vault.getName(),
				initialStyle: this.settings.currentTheme,
				mapData: mapData,
				localPlotlyUrl: "./plotly.min.js",
			});
			mapData.htmlContent = standaloneHtml;

			try {
				await this.app.vault.adapter.write(`${pluginDir}/knowledge_map.html`, standaloneHtml);
			} catch (e) {
				console.warn("[Knowledge Map] 写入 knowledge_map.html 失败:", e);
			}

			this.mapData = mapData;
			await this.saveMapState();

			// Step 6: Render View
			if (this.statusBarItem) this.statusBarItem.setText("");
			if (view) {
				view.hideProgress();
				await view.render();
			}
			new Notice(`✅ 知识地图生成成功！共收录 ${allCached.length} 篇笔记。`);
		} catch (err: any) {
			console.error("[Knowledge Map] 生成地图失败:", err);
			if (this.statusBarItem) this.statusBarItem.setText("");
			new Notice(`❌ 生成失败: ${err.message || err}`, 8000);
			if (view) {
				view.showError(err.message || String(err));
			}
		} finally {
			this.isGenerating = false;
		}
	}
}
