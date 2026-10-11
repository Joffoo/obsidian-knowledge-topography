import { requestUrl } from "obsidian";
import { KnowledgeMapSettings } from "../types";

export interface NoteRepresentative {
	title: string;
	tags?: string[];
	snippet?: string;
}

export interface ClusterSample {
	clusterId: number;
	notesCount: number;
	coreNotes: NoteRepresentative[];
}

interface DomainItem {
	id: number;
	domain: unknown;
}

interface ChatResponse {
	choices?: { message?: { content?: string } }[];
}

export class LLMSynthesizer {
	private settings: KnowledgeMapSettings;

	constructor(settings: KnowledgeMapSettings) {
		this.settings = settings;
	}

	updateSettings(settings: KnowledgeMapSettings): void {
		this.settings = settings;
	}

	async testConnection(): Promise<{ success: boolean; message: string }> {
		const baseUrl = this.settings.llmBaseUrl.replace(/\/+$/, "");
		const endpoint = `${baseUrl}/chat/completions`;

		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (this.settings.llmApiKey) {
				headers["Authorization"] = `Bearer ${this.settings.llmApiKey}`;
			}

			const timeoutPromise = new Promise<never>((_, reject) =>
				window.setTimeout(() => reject(new Error("连接超时 (10s)")), 10000)
			);

			const fetchPromise = requestUrl({
				url: endpoint,
				method: "POST",
				headers: headers,
				body: JSON.stringify({
					model: this.settings.llmModelName,
					messages: [
						{ role: "system", content: "You are a helpful assistant." },
						{ role: "user", content: "Ping! Please respond with 'OK'." },
					],
					max_tokens: 10,
				}),
			});

			const response = await Promise.race([fetchPromise, timeoutPromise]);

			if (response.status === 200) {
				const data = response.json as ChatResponse | null;
				const content = data?.choices?.[0]?.message?.content ?? "";
				return { success: true, message: `连接成功！模型响应: ${content.trim()}` };
			} else {
				return {
					success: false,
					message: `HTTP ${response.status}: ${response.text.slice(0, 200)}`,
				};
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return { success: false, message: `连接失败: ${msg}` };
		}
	}

	async synthesizeDomains(clusters: ClusterSample[]): Promise<Map<number, string>> {
		const result = new Map<number, string>();
		if (clusters.length === 0) return result;

		// If no LLM API key configured and not localhost, generate fallback heuristic labels
		if (!this.settings.llmApiKey && !this.settings.llmBaseUrl.includes("localhost")) {
			for (const c of clusters) {
				const fallback = this.extractFallbackDomain(c);
				result.set(c.clusterId, fallback);
			}
			return result;
		}

		const baseUrl = this.settings.llmBaseUrl.replace(/\/+$/, "");
		const endpoint = `${baseUrl}/chat/completions`;

		const clusterDescriptions = clusters.map((c) => {
			const noteLines = c.coreNotes.slice(0, 6).map((n) => {
				const tagPart = n.tags && n.tags.length > 0 ? ` [标签: #${n.tags.join(" #")}]` : "";
				const snippetPart = n.snippet ? ` | 导语: ${n.snippet.slice(0, 45).replace(/\s+/g, " ").trim()}...` : "";
				return `  • 《${n.title}》${tagPart}${snippetPart}`;
			}).join("\n");

			return `【山峰 #${c.clusterId + 1}】(包含 ${c.notesCount} 篇笔记):\n${noteLines || "  (暂无代表笔记)"}`;
		}).join("\n\n");

		const systemPrompt = `你是一个知识图谱与语义分类领域的资深专家，正在为用户的个人知识库（Obsidian 知识地貌地图）归纳核心知识山峰的领域标签。

【任务】
根据每座知识山峰中核心代表笔记的标题、标签及简短导语，为每个聚类提炼一个高信息量、精炼、高级的中文领域标签。

【严格命名规则】
1. 字符长度：严格限制为 2 ~ 4 个中文字符的名词短语（严禁超过 4 个字符）。
2. 信息密度：必须是具体的学科、技术栈、生活门类或核心研究领域（例如："认知哲学"、"量化投资"、"大模型算法"、"手冲咖啡"、"系统设计"）。
3. 负面约束：严禁输出模糊无信息量的废话词（如"综合杂项"、"其他笔记"、"个人思考"、"日常随笔"、"读书摘抄"等）。
4. 输出格式：严禁任何多余解释与客套话，必须输出严格合法的 JSON 数组格式。

【示例】
输入：
【山峰 #1】(包含 42 篇笔记):
  • 《耶加雪菲水洗处理分析》 [标签: #咖啡 #饮品] | 导语: 探讨水洗耶加雪菲的柑橘酸质与茉莉花香风味表现...
  • 《意式浓缩萃取金杯准则》 [标签: #萃取] | 导语: 探讨水粉比1:2在9bar压力下的萃取率...
输出：
[
  {"id": 1, "domain": "咖啡研学"}
]`;

		const userPrompt = `以下是当前知识库地貌中各山峰的核心笔记样本：

${clusterDescriptions}

请严格按照要求的 JSON 数组格式输出每个山峰对应的 2~4 字中文领域标签：`;

		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (this.settings.llmApiKey) {
				headers["Authorization"] = `Bearer ${this.settings.llmApiKey}`;
			}

			// 15-second timeout safeguard to prevent hanging
			const timeoutPromise = new Promise<never>((_, reject) =>
				window.setTimeout(() => reject(new Error("LLM API 响应超时 (15s)")), 15000)
			);

			const fetchPromise = requestUrl({
				url: endpoint,
				method: "POST",
				headers: headers,
				body: JSON.stringify({
					model: this.settings.llmModelName,
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: userPrompt },
					],
					temperature: 0.2,
				}),
			});

			const response = await Promise.race([fetchPromise, timeoutPromise]);

			if (response.status !== 200) {
				throw new Error(`LLM API 返回错误代码 ${response.status}`);
			}

			const data = response.json as ChatResponse | null;
			let content = data?.choices?.[0]?.message?.content ?? "";
			// Strip markdown code block markers
			content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]) as DomainItem[];
				for (const item of parsed) {
					if (typeof item.id === "number" && item.domain) {
						let domain = String(item.domain).trim();
						if (domain.length > 4) domain = domain.slice(0, 4);
						result.set(item.id - 1, domain);
					}
				}
			}
		} catch (err: unknown) {
			console.warn("[Knowledge Map] LLM 总结失败或超时，自动启用高质量本地先验降级:", err);
		}

		// Fill missing with fallback
		for (const c of clusters) {
			if (!result.has(c.clusterId)) {
				const fallback = this.extractFallbackDomain(c);
				result.set(c.clusterId, fallback);
			}
		}

		return result;
	}

	private extractFallbackDomain(cluster: ClusterSample): string {
		const firstNote = cluster.coreNotes[0];
		if (!firstNote) return `领域 ${cluster.clusterId + 1}`;

		// 1. Prioritize explicit note tags
		if (firstNote.tags && firstNote.tags.length > 0) {
			const tag = firstNote.tags[0].replace(/^领域\//, "").replace(/^学科\//, "");
			return tag.slice(0, 4);
		}

		// 2. Use clean title keywords
		if (firstNote.title) {
			const clean = firstNote.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
			return clean.slice(0, 4) || `领域 ${cluster.clusterId + 1}`;
		}

		return `领域 ${cluster.clusterId + 1}`;
	}
}
