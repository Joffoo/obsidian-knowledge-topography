import { Plugin, Notice, TFile } from "obsidian";
import { DEFAULT_SETTINGS, KnowledgeMapSettings, MapData, NoteItem, Point2D, SemanticSearchResultItem, VaultLinkItem } from "./types";
import { KnowledgeMapSettingTab } from "./settings";
import { KnowledgeMapView, KNOWLEDGE_MAP_VIEW_TYPE } from "./views/KnowledgeMapView";
import { EmbeddingCacheManager } from "./services/cache";
import { VaultIndexer, resolveNoteTimestamp } from "./services/indexer";
import { EmbeddingService } from "./services/embedding";
import { LLMSynthesizer, ClusterSample, SynthesizeResult } from "./services/llm";
import { SpatialComputer } from "./services/spatial";
import { HtmlMapGenerator } from "./services/htmlGenerator";
import { t, resolveLocale } from "./i18n";

export default class KnowledgeMapPlugin extends Plugin {
	settings: KnowledgeMapSettings;
	cacheManager: EmbeddingCacheManager;
	indexer: VaultIndexer;
	embeddingService: EmbeddingService;
	llmSynthesizer: LLMSynthesizer;
	spatialComputer: SpatialComputer;
	isGenerating = false;
	lastErrorStack: string = "";
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

		this.addCommand({
			id: "locate-active-note",
			name: t(this.settings.locale).cmd_locate,
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return false;
				if (checking) return true;

				void (async () => {
					await this.activateView();
					const view = this.getActiveView();
					if (view) {
						view.locateNote(activeFile.path);
					}
				})();
				return true;
			},
		});

		this.addCommand({
			id: "search-knowledge-map",
			name: t(this.settings.locale).cmd_search,
			callback: () => {
				void (async () => {
					await this.activateView();
					const view = this.getActiveView();
					if (view) {
						view.focusSearch();
					}
				})();
			},
		});

		this.addCommand({
			id: "toggle-wikilinks-network",
			name: t(this.settings.locale).cmd_toggle_wikilinks,
			callback: () => {
				const view = this.getActiveView();
				if (view) {
					view.toggleWikilinks();
				}
			},
		});

		this.addCommand({
			id: "rename-knowledge-map-summits",
			name: t(this.settings.locale).cmd_rename_summits,
			callback: () => {
				void this.renameSummitsOnly();
			},
		});

		// 5. Register Active Leaf Change for Auto-Locating (Radar Probe)
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (!this.settings.autoLocateActiveNote) return;
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || activeFile.extension !== "md") return;

				const view = this.getActiveView();
				if (view) {
					view.locateNote(activeFile.path);
				}
			})
		);

		// 6. Register Settings Tab
		this.addSettingTab(new KnowledgeMapSettingTab(this.app, this));
	}

	onunload(): void {
		// Do not detach leaves in onunload per official Obsidian review guidelines
		this.embeddingService?.cancel();
		this.llmSynthesizer?.cancel();
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Record<string, unknown> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
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
				this.mapData = JSON.parse(content) as MapData;
				if (this.mapData && Array.isArray(this.mapData.points)) {
					for (const pt of this.mapData.points) {
						const file = this.app.vault.getAbstractFileByPath(pt.path);
						if (file instanceof TFile) {
							pt.ctime = resolveNoteTimestamp(this.app, file, this.settings.timeFrontmatterKey);
						} else if (!pt.ctime || pt.ctime <= 0) {
							pt.ctime = Date.now();
						}
					}
				}
			}
		} catch (e: unknown) {
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

	extractVaultLinks(points: Point2D[]): VaultLinkItem[] {
		const validPaths = new Set(points.map((p) => p.path));
		const links: VaultLinkItem[] = [];

		const resolved = this.app.metadataCache.resolvedLinks;
		if (!resolved) return links;

		for (const sourcePath of validPaths) {
			const destinations = resolved[sourcePath];
			if (!destinations) continue;

			for (const targetPath of Object.keys(destinations)) {
				if (!validPaths.has(targetPath) || sourcePath === targetPath) continue;
				links.push({ source: sourcePath, target: targetPath });
			}
		}
		return links;
	}

	async searchTopography(query: string): Promise<SemanticSearchResultItem[]> {
		if (!this.mapData || !this.mapData.points || this.mapData.points.length === 0) {
			throw new Error(t(this.settings.locale).search_not_built);
		}

		const queryVector = await this.embeddingService.computeQueryEmbedding(query);
		if (!queryVector || queryVector.length === 0) {
			throw new Error("未能生成搜索向量。");
		}

		// Calculate cosine similarities with all cached vectors
		const allCached = this.cacheManager.getAll();
		const pointMap = new Map<string, (typeof this.mapData.points)[0]>();
		for (const pt of this.mapData.points) {
			pointMap.set(pt.path, pt);
		}

		const clusterMap = new Map<number, string>();
		if (this.mapData.clusters) {
			for (const c of this.mapData.clusters) {
				clusterMap.set(c.id, c.domain);
			}
		}

		const scoredItems: SemanticSearchResultItem[] = [];

		for (const cached of allCached) {
			if (!cached.vector || cached.vector.length === 0) continue;
			const pt = pointMap.get(cached.path);
			if (!pt) continue;

			const sim = this.cosineSimilarity(queryVector, cached.vector);
			scoredItems.push({
				path: pt.path,
				title: pt.title,
				folder: pt.folder || "/",
				similarity: Number(sim.toFixed(4)),
				similarityPercent: Math.max(0, Math.min(100, Math.round(sim * 100))),
				x: pt.x,
				y: pt.y,
				clusterId: pt.clusterId,
				clusterDomain: clusterMap.get(pt.clusterId) || "未命名山峰",
			});
		}

		scoredItems.sort((a, b) => b.similarity - a.similarity);
		return scoredItems.slice(0, 8);
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length || a.length === 0) return 0;
		let dot = 0;
		let normA = 0;
		let normB = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		if (normA <= 0 || normB <= 0) return 0;
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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
		this.isGenerating = false;
		this.embeddingService.cancel();
		this.llmSynthesizer.cancel();
		const view = this.getActiveView();
		if (view) {
			view.hideProgress();
			if (!this.mapData) view.showEmptyState();
		}
		if (this.statusBarItem) this.statusBarItem.setText("");
		new Notice("已取消知识地图计算任务。");
	}

	private async runSummitSynthesis(
		clusterSamples: ClusterSample[],
		view: KnowledgeMapView | null,
		stageTitle: string,
		progressCurrent: number,
		progressTotal: number
	): Promise<SynthesizeResult> {
		const startMsg = t(this.settings.locale).llm_stage_connecting;
		if (this.statusBarItem) this.statusBarItem.setText(`🗺️ 知识地图: ${startMsg}`);
		if (view) view.showProgress(startMsg, progressCurrent, progressTotal, stageTitle);

		return await this.llmSynthesizer.synthesizeDomains(clusterSamples, (evt) => {
			if (!this.isGenerating) return;
			if (this.statusBarItem) this.statusBarItem.setText(`🗺️ 知识地图: ${evt.message}`);
			if (view) view.showProgress(evt.message, progressCurrent, progressTotal, stageTitle);
		});
	}

	private async persistAndRenderMap(mapData: MapData, view: KnowledgeMapView | null): Promise<void> {
		const pluginDir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/knowledge-topography`;
		const standaloneHtml = HtmlMapGenerator.generate({
			vaultName: this.app.vault.getName(),
			initialStyle: this.settings.currentTheme,
			mapData: mapData,
			localPlotlyUrl: "./plotly.min.js",
			showTimeSlider: this.settings.showTimeSlider,
			locale: resolveLocale(this.settings.locale),
		});
		mapData.htmlContent = standaloneHtml;

		try {
			await this.app.vault.adapter.write(`${pluginDir}/knowledge_map.html`, standaloneHtml);
		} catch (e) {
			console.warn("[Knowledge Map] 写入 knowledge_map.html 失败:", e);
		}

		this.mapData = mapData;
		await this.saveMapState();

		if (this.statusBarItem) this.statusBarItem.setText("");
		if (view) {
			view.hideProgress();
			await view.render();
		}
	}

	async renameSummitsOnly(): Promise<void> {
		const i18n = t(this.settings.locale);
		if (this.isGenerating) {
			new Notice(i18n.notice_busy);
			return;
		}
		if (!this.mapData || !Array.isArray(this.mapData.clusters) || this.mapData.clusters.length === 0) {
			new Notice(i18n.notice_rename_requires_map);
			return;
		}

		const view = this.getActiveView();
		this.isGenerating = true;

		try {
			const clusterSamples: ClusterSample[] = [];
			for (const c of this.mapData.clusters) {
				const coreNotes = [];
				for (const n of c.notes.slice(0, 10)) {
					const file = this.app.vault.getAbstractFileByPath(n.path);
					if (file instanceof TFile) {
						const meta = await this.indexer.extractNoteMetadata(file);
						coreNotes.push({
							title: n.title,
							tags: meta.tags,
							snippet: meta.snippet,
						});
					} else {
						coreNotes.push({
							title: n.title,
							tags: n.tags ?? [],
							snippet: n.snippet ?? "",
						});
					}
				}
				clusterSamples.push({
					clusterId: c.id,
					notesCount: c.notes.length,
					coreNotes,
				});
			}

			const synthResult = await this.runSummitSynthesis(
				clusterSamples,
				view,
				i18n.stage_rename_peaks,
				0,
				0
			);

			if (synthResult.failureCategory === "cancelled" || !this.isGenerating) {
				return;
			}

			for (const cluster of this.mapData.clusters) {
				if (synthResult.domains.has(cluster.id)) {
					cluster.domain = synthResult.domains.get(cluster.id)!;
				}
			}

			await this.persistAndRenderMap(this.mapData, view);

			const elapsedSec = (synthResult.totalMs / 1000).toFixed(1);
			const locale = resolveLocale(this.settings.locale);
			if (synthResult.source === "llm") {
				new Notice(
					i18n.notice_rename_ok(
						this.mapData.clusters.length,
						synthResult.model || this.settings.llmModelName || "LLM",
						elapsedSec
					),
					6000
				);
			} else if (synthResult.failureCategory === "not-configured") {
				new Notice(
					i18n.notice_rename_ok(
						this.mapData.clusters.length,
						locale === "en" ? "Local TF-IDF" : "本地语义兜底",
						elapsedSec
					),
					6000
				);
			} else {
				const reason = synthResult.failureMessage || synthResult.failureCategory || "unknown";
				new Notice(i18n.notice_rename_fallback(reason), 10000);
			}
		} catch (err: unknown) {
			if (!this.isGenerating) return;
			const errMsg = err instanceof Error ? err.message : String(err);
			console.error("[Knowledge Map] 山峰重命名失败:", err);
			if (this.statusBarItem) this.statusBarItem.setText("");
			if (view) view.hideProgress();
			new Notice(`❌ ${errMsg}`, 8000);
		} finally {
			this.isGenerating = false;
		}
	}

	async generateMap(): Promise<void> {
		const i18n = t(this.settings.locale);
		if (this.isGenerating) {
			new Notice(i18n.notice_busy);
			return;
		}
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
							ctime: targetNote.ctime,
							vector: vec,
						});
					}
				}
				await this.cacheManager.save();
			}

			// Collect all valid embeddings with folder and ctime info
			const allCached = this.cacheManager.getAll().filter((c) =>
				notes.some((n) => n.path === c.path)
			).map((c) => {
				const n = notes.find((item) => item.path === c.path);
				return {
					...c,
					ctime: n?.ctime || c.ctime || n?.mtime || c.mtime,
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
			mapData.links = this.extractVaultLinks(mapData.points);

			// Step 5: LLM Domain Synthesis
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

			const synthResult = await this.runSummitSynthesis(
				clusterSamples,
				view,
				`阶段 4/4 · ${i18n.stage_peaks}`,
				95,
				100
			);
			if (synthResult.failureCategory === "cancelled" || !this.isGenerating) {
				return;
			}
			for (const cluster of mapData.clusters) {
				if (synthResult.domains.has(cluster.id)) {
					cluster.domain = synthResult.domains.get(cluster.id)!;
				}
			}

			// Generate standalone HTML and save state
			await this.persistAndRenderMap(mapData, view);

			if (synthResult.source === "llm" || synthResult.failureCategory === "not-configured") {
				new Notice(`✅ 知识地图生成成功！共收录 ${allCached.length} 篇笔记。`);
			} else if (synthResult.source === "partial-fallback") {
				const reason = synthResult.failureMessage || synthResult.failureCategory || "unknown";
				new Notice(
					i18n.notice_map_ok_llm_partial(allCached.length, synthResult.fallbackCount, reason),
					9000
				);
			} else {
				const reason = synthResult.failureMessage || synthResult.failureCategory || "unknown";
				new Notice(i18n.notice_map_ok_llm_fallback(allCached.length, reason), 10000);
			}
		} catch (err: unknown) {
			if (!this.isGenerating) return;
			const errMsg = err instanceof Error ? err.message : String(err);
			const errStack = err instanceof Error ? err.stack : "";
			this.lastErrorStack = errStack || errMsg;
			console.error("[Knowledge Map] 生成地图失败:", err, errStack);
			if (this.statusBarItem) this.statusBarItem.setText("");
			new Notice(`❌ 生成失败: ${errMsg}`, 8000);
			if (view) {
				view.showError(errMsg);
			}
		} finally {
			this.isGenerating = false;
		}
	}
}

