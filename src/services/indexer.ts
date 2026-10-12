import { App, TFile } from "obsidian";
import { NoteItem, KnowledgeMapSettings } from "../types";

export function resolveNoteTimestamp(app: App, file: TFile, yamlField?: string): number {
	// 1. 若指定了 YAML 字段，尝试从笔记 frontmatter 读取
	const field = yamlField?.trim();
	if (field) {
		const fileCache = app.metadataCache.getFileCache(file);
		const rawVal = fileCache?.frontmatter?.[field];
		if (rawVal !== undefined && rawVal !== null) {
			if (typeof rawVal === "number") {
				const ms = rawVal < 10000000000 ? rawVal * 1000 : rawVal;
				if (ms > 0) return ms;
			}
			const parsed = Date.parse(String(rawVal).trim());
			if (!isNaN(parsed) && parsed > 0) {
				return parsed;
			}
		}
	}

	// 2. 通用方法：直接使用文件的创建时间 ctime（兜底使用修改时间 mtime）
	return file.stat.ctime > 0 ? file.stat.ctime : (file.stat.mtime || Date.now());
}

export class VaultIndexer {
	private app: App;
	private settings: KnowledgeMapSettings;

	constructor(app: App, settings: KnowledgeMapSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: KnowledgeMapSettings): void {
		this.settings = settings;
	}

	async scanNotes(
		onProgress?: (current: number, total: number, message: string) => void
	): Promise<NoteItem[]> {
		const files = this.app.vault.getMarkdownFiles();
		const excludedList = this.settings.excludedFolders
			.split(/[,，\n\r]+/)
			.map((s) => s.trim().replace(/^\/+|\/+$/g, ""))
			.filter((s) => s.length > 0);

		const result: NoteItem[] = [];
		const total = files.length;

		for (let i = 0; i < total; i++) {
			const file = files[i];

			if (onProgress && (i % 10 === 0 || i === total - 1)) {
				onProgress(i + 1, total, `正在扫描与提取笔记 (${i + 1}/${total}): ${file.basename}`);
			}

			if (this.isExcluded(file.path, excludedList)) {
				continue;
			}

			// Read file text
			const text = await this.app.vault.read(file);
			const cleanContent = this.cleanMarkdown(text);
			if (cleanContent.trim().length === 0) {
				continue;
			}

			const snippet = cleanContent.slice(0, this.settings.maxCharsPerNote);

			// Extract tags from Obsidian metadata cache
			const fileCache = this.app.metadataCache.getFileCache(file);
			const rawTags: string[] = [];
			if (fileCache?.tags) {
				for (const t of fileCache.tags) {
					if (t.tag) rawTags.push(t.tag);
				}
			}
			if (fileCache?.frontmatter?.tags) {
				const fmTags: unknown = fileCache.frontmatter.tags;
				if (Array.isArray(fmTags)) {
					for (const t of fmTags) rawTags.push(String(t));
				} else if (typeof fmTags === "string") {
					for (const t of fmTags.split(/[\s,]+/)) if (t.trim()) rawTags.push(t.trim());
				}
			}
			const tags = Array.from(
				new Set(rawTags.map((t) => t.replace(/^#/, "").trim()))
			).filter((t) => t.length > 0).slice(0, 5);

			// Note timestamp extraction (custom YAML field or universal ctime)
			const ctime = resolveNoteTimestamp(this.app, file, this.settings.timeFrontmatterKey);

			const folderName = file.parent && file.parent.path ? file.parent.path : "/";

			result.push({
				path: file.path,
				title: file.basename,
				folder: folderName,
				mtime: file.stat.mtime,
				ctime: ctime,
				size: file.stat.size,
				contentSnippet: snippet,
				tags,
			});
		}

		if (onProgress) {
			onProgress(total, total, `笔记扫描完成，共筛选出 ${result.length} 篇有效笔记`);
		}

		return result;
	}

	private isExcluded(path: string, excludedList: string[]): boolean {
		const cleanPath = path.replace(/^\/+/, "");
		for (const ex of excludedList) {
			if (!ex) continue;
			if (cleanPath === ex || cleanPath.startsWith(ex + "/") || cleanPath.includes("/" + ex + "/")) {
				return true;
			}
		}
		return false;
	}

	private cleanMarkdown(raw: string): string {
		let text = raw;

		// 1. Remove YAML frontmatter
		if (text.startsWith("---")) {
			const endIdx = text.indexOf("\n---", 3);
			if (endIdx !== -1) {
				text = text.slice(endIdx + 4);
			}
		}

		// 2. Remove code blocks
		text = text.replace(/```[\s\S]*?```/g, " ");

		// 3. Remove inline code
		text = text.replace(/`[^`]+`/g, " ");

		// 4. Remove images
		text = text.replace(/!\[\[.*?\]\]/g, " ");
		text = text.replace(/!\[.*?\]\(.*?\)/g, " ");

		// 5. Clean wikilinks [[Page|Alias]] -> Alias or Page
		text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
		text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");

		// 6. Clean standard markdown links [text](url) -> text
		text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

		// 7. Remove markdown headers (#, ##, etc.)
		text = text.replace(/^#+\s+/gm, " ");

		// 8. Collapse whitespace
		text = text.replace(/\s+/g, " ").trim();

		return text;
	}
}
