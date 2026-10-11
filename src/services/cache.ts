import { App, Plugin } from "obsidian";
import { CachedEmbedding } from "../types";

export class EmbeddingCacheManager {
	private app: App;
	private plugin: Plugin;
	private cache: Map<string, CachedEmbedding> = new Map();
	private cacheFilePath: string;

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.cacheFilePath = `${this.plugin.manifest.dir}/cache.json`;
	}

	async load(): Promise<void> {
		try {
			if (await this.app.vault.adapter.exists(this.cacheFilePath)) {
				const content = await this.app.vault.adapter.read(this.cacheFilePath);
				const data = JSON.parse(content) as Record<string, CachedEmbedding>;
				this.cache.clear();
				for (const [k, v] of Object.entries(data)) {
					this.cache.set(k, v);
				}
			}
		} catch (e) {
			console.warn("[Knowledge Map] Failed to load cache, initializing empty cache", e);
			this.cache.clear();
		}
	}

	async save(): Promise<void> {
		try {
			const obj: Record<string, CachedEmbedding> = {};
			for (const [k, v] of this.cache.entries()) {
				obj[k] = v;
			}
			await this.app.vault.adapter.write(this.cacheFilePath, JSON.stringify(obj));
		} catch (e) {
			console.error("[Knowledge Map] Failed to save cache", e);
		}
	}

	get(path: string): CachedEmbedding | undefined {
		return this.cache.get(path);
	}

	set(path: string, item: CachedEmbedding): void {
		this.cache.set(path, item);
	}

	hasValid(path: string, mtime: number): boolean {
		const item = this.cache.get(path);
		if (!item) return false;
		return item.mtime === mtime && Array.isArray(item.vector) && item.vector.length > 0;
	}

	remove(path: string): void {
		this.cache.delete(path);
	}

	async clear(): Promise<void> {
		this.cache.clear();
		if (await this.app.vault.adapter.exists(this.cacheFilePath)) {
			await this.app.vault.adapter.remove(this.cacheFilePath);
		}
	}

	size(): number {
		return this.cache.size;
	}

	getAll(): CachedEmbedding[] {
		return Array.from(this.cache.values());
	}
}
