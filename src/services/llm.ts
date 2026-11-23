import { requestUrl } from "obsidian";
import { resolveLocale } from "../i18n";
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

export type LLMPhase =
	| "connecting"
	| "thinking"
	| "generating"
	| "fallback-request"
	| "done";

export interface LLMProgressEvent {
	phase: LLMPhase;
	model?: string;
	elapsedMs: number;
	thinkingChars: number;
	contentChars: number;
	message: string;
}

export type LLMFailureCategory =
	| "not-configured"
	| "connect-timeout"
	| "stream-idle-timeout"
	| "total-timeout"
	| "http-error"
	| "network-error"
	| "parse-error"
	| "empty-response"
	| "cancelled";

export interface SynthesizeResult {
	domains: Map<number, string>;
	source: "llm" | "partial-fallback" | "fallback";
	model?: string;
	usedStreaming: boolean;
	isReasoningModel: boolean;
	ttfbMs?: number;
	totalMs: number;
	llmCount: number;
	fallbackCount: number;
	failureCategory?: LLMFailureCategory;
	failureMessage?: string;
}

export interface TestConnectionResult {
	success: boolean;
	message: string;
	model?: string;
	ttfbMs?: number;
	isReasoningModel?: boolean;
	usedStreaming?: boolean;
	failureCategory?: LLMFailureCategory;
}

export interface LLMSynthesizerOptions {
	fetchFn?: typeof fetch;
	requestUrlFn?: typeof requestUrl;
	connectTimeoutMs?: number;
	idleTimeoutMs?: number;
	totalTimeoutMs?: number;
	fallbackTimeoutMs?: number;
	testConnectTimeoutMs?: number;
	testIdleTimeoutMs?: number;
}

interface ChatCompletionDelta {
	content?: unknown;
	reasoning_content?: unknown;
	reasoning?: unknown;
	thinking?: unknown;
}

interface ChatCompletionPayload {
	model?: string;
	choices?: {
		delta?: ChatCompletionDelta;
		message?: ChatCompletionDelta;
	}[];
	error?: { message?: unknown };
	message?: unknown;
}

interface TransportOutput {
	model?: string;
	content: string;
	reasoning: string;
	usedStreaming: boolean;
	isReasoningModel: boolean;
	ttfbMs?: number;
	totalMs: number;
}

interface ActiveRequestHandle {
	cancel: () => void;
}

class LLMRequestError extends Error {
	readonly category: LLMFailureCategory;

	constructor(category: LLMFailureCategory, message: string) {
		super(message);
		this.name = "LLMRequestError";
		this.category = category;
	}
}

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 180_000;
const DEFAULT_FALLBACK_TIMEOUT_MS = 90_000;
const DEFAULT_TEST_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_TEST_IDLE_TIMEOUT_MS = 15_000;
const PROGRESS_THROTTLE_MS = 250;

const LATIN_STOPWORDS = new Set([
	"the", "and", "for", "with", "from", "into", "about", "that", "this",
	"note", "notes", "how", "what", "why", "when", "where", "your", "using",
	"via", "part", "vol", "day", "week", "year",
]);

/**
 * Determine whether an API base URL points to a local loopback host that does not require an API key.
 */
export function isLocalEndpoint(rawUrl: string): boolean {
	const trimmed = rawUrl.trim();
	if (!trimmed) return false;

	const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
		? trimmed
		: `http://${trimmed}`;

	try {
		const parsed = new URL(candidate);
		const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
		return (
			host === "localhost" ||
			host === "127.0.0.1" ||
			host === "::1" ||
			host === "0.0.0.0"
		);
	} catch {
		return /(?:^|\/\/)(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::|\/|$)/i.test(trimmed);
	}
}

/**
 * Remove inline `<think>...</think>` blocks (including trailing unclosed `<think>`).
 */
export function stripThinkBlocks(text: string): { cleaned: string; hadThinkBlock: boolean } {
	const hadThinkBlock = /<think>/i.test(text);
	let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
	cleaned = cleaned.replace(/<think>[\s\S]*$/i, "");
	return { cleaned: cleaned.trim(), hadThinkBlock };
}

/**
 * Scan balanced JSON `[...]` slices while ignoring brackets inside quoted JSON string literals.
 */
function extractBalancedArraySlices(text: string): string[] {
	const slices: string[] = [];
	let i = 0;

	while (i < text.length) {
		if (text[i] !== "[") {
			i++;
			continue;
		}

		let depth = 0;
		let inString = false;
		let escaped = false;
		let matchedEnd = -1;

		for (let j = i; j < text.length; j++) {
			const ch = text[j];
			if (inString) {
				if (escaped) {
					escaped = false;
				} else if (ch === "\\") {
					escaped = true;
				} else if (ch === '"') {
					inString = false;
				}
				continue;
			}

			if (ch === '"') {
				inString = true;
			} else if (ch === "[") {
				depth++;
			} else if (ch === "]") {
				depth--;
				if (depth === 0) {
					matchedEnd = j;
					break;
				}
			}
		}

		if (matchedEnd !== -1) {
			const slice = text.slice(i, matchedEnd + 1);
			slices.push(slice);
			try {
				JSON.parse(slice);
				i = matchedEnd + 1;
				continue;
			} catch {
				// Keep advancing by 1 so an unclosed/invalid outer '[' cannot mask an inner JSON array
			}
		}
		i++;
	}

	return slices;
}

function sanitizeDomainLabel(raw: string): string {
	let label = raw
		.replace(/^[\s"'“”‘’「」《》#]+|[\s"'“”‘’「」《》]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!label) return "";

	const hasLatin = /[a-zA-Z]/.test(label);
	const chars = Array.from(label);
	if (!hasLatin) {
		if (chars.length > 4) {
			label = chars.slice(0, 4).join("");
		}
	} else if (chars.length > 16) {
		label = chars.slice(0, 16).join("").trim();
	}
	return label;
}

function parseClusterNumberId(rawId: unknown): number | null {
	if (typeof rawId === "number") {
		return Number.isInteger(rawId) ? rawId : null;
	}
	if (typeof rawId === "string") {
		const m = rawId.trim().match(/^#?(?:山峰\s*#?|peak\s*#?)?(\d+)$/i) ?? rawId.match(/(\d+)/);
		if (m) {
			const parsed = parseInt(m[1], 10);
			return Number.isFinite(parsed) ? parsed : null;
		}
	}
	return null;
}

function unwrapArrayFromParsed(parsed: unknown): unknown[] | null {
	if (Array.isArray(parsed)) return parsed;
	if (parsed && typeof parsed === "object") {
		const record = parsed as Record<string, unknown>;
		for (const key of ["clusters", "domains", "items", "results", "data"]) {
			if (Array.isArray(record[key])) return record[key] as unknown[];
		}
		for (const value of Object.values(record)) {
			if (Array.isArray(value)) return value as unknown[];
		}
	}
	return null;
}

/**
 * Parse LLM domain array output safely after stripping `<think>` blocks and code fences.
 */
export function parseDomainsFromContent(
	rawContent: string,
	validClusterIds: Set<number>,
	_locale: "zh" | "en"
): { map: Map<number, string>; hadThinkBlock: boolean; error?: "empty" | "parse" } {
	const { cleaned, hadThinkBlock } = stripThinkBlocks(rawContent);
	if (!cleaned) {
		return { map: new Map<number, string>(), hadThinkBlock, error: "empty" };
	}

	const candidates: string[] = [];
	const seenCandidates = new Set<string>();
	const addCandidate = (s: string) => {
		const trimmed = s.trim();
		if (trimmed && !seenCandidates.has(trimmed)) {
			seenCandidates.add(trimmed);
			candidates.push(trimmed);
		}
	};

	const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
	let fenceMatch: RegExpExecArray | null;
	while ((fenceMatch = fenceRegex.exec(cleaned)) !== null) {
		addCandidate(fenceMatch[1]);
	}

	addCandidate(cleaned);

	for (const slice of extractBalancedArraySlices(cleaned)) {
		addCandidate(slice);
	}

	let bestMap = new Map<number, string>();

	for (const candidate of candidates) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(candidate);
		} catch {
			continue;
		}

		const list = unwrapArrayFromParsed(parsed);
		if (!list) continue;

		const currentMap = new Map<number, string>();
		for (const entry of list) {
			if (!entry || typeof entry !== "object") continue;
			const item = entry as Record<string, unknown>;
			const numericId = parseClusterNumberId(item.id);
			if (numericId === null) continue;

			const clusterId = numericId - 1;
			if (!validClusterIds.has(clusterId)) continue;

			const rawDomain = item.domain ?? item.name ?? item.label;
			if (typeof rawDomain !== "string" && typeof rawDomain !== "number") continue;

			const domain = sanitizeDomainLabel(String(rawDomain));
			if (domain) {
				currentMap.set(clusterId, domain);
			}
		}

		// Prefer candidate covering more clusters; break ties toward later blocks
		if (currentMap.size > 0 && currentMap.size >= bestMap.size) {
			bestMap = currentMap;
		}
	}

	if (bestMap.size === 0) {
		return { map: bestMap, hadThinkBlock, error: "parse" };
	}

	return { map: bestMap, hadThinkBlock };
}

function extractTagLeafLabel(rawTag: string): string {
	const clean = rawTag.replace(/^#+/, "").trim();
	const segments = clean.split("/").map((s) => s.trim()).filter(Boolean);
	if (segments.length === 0) return "";
	if (segments.length === 1) return sanitizeDomainLabel(segments[0]);
	if (segments.length === 2) return sanitizeDomainLabel(segments[1]);

	const leaf = segments[segments.length - 1];
	const parent = segments[segments.length - 2];
	const isPureCjk = (s: string) => /^[\u4e00-\u9fa5]+$/.test(s);

	if (
		isPureCjk(parent) &&
		isPureCjk(leaf) &&
		Array.from(leaf).length <= 2 &&
		Array.from(parent + leaf).length <= 4
	) {
		return sanitizeDomainLabel(`${parent}${leaf}`);
	}

	return sanitizeDomainLabel(leaf);
}

function extractTitleTokens(title: string): string[] {
	const cleaned = title
		.replace(/[《》【】()（）\[\]「」『』"'“”‘’]/g, " ")
		.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, " ")
		.trim();
	if (!cleaned) return [];

	const tokens = new Set<string>();

	const latinMatches = cleaned.match(/[a-zA-Z][a-zA-Z0-9_-]{1,15}/g) ?? [];
	for (const word of latinMatches) {
		if (!LATIN_STOPWORDS.has(word.toLowerCase())) {
			tokens.add(word);
		}
	}

	const cjkRuns = cleaned.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
	for (const run of cjkRuns) {
		const chars = Array.from(run);
		if (chars.length <= 4) {
			tokens.add(run);
		} else {
			for (const n of [2, 3, 4]) {
				for (let i = 0; i <= chars.length - n; i++) {
					tokens.add(chars.slice(i, i + n).join(""));
				}
			}
		}
	}

	return Array.from(tokens);
}

/**
 * General, zero-hardcoding fallback naming using cross-cluster TF-IDF over tags,
 * semantic leaf extraction for hierarchical tags, and title-keyword fallback.
 */
export function buildFallbackDomains(
	clusters: ClusterSample[],
	locale: "zh" | "en",
	reservedLabels?: Set<string>
): Map<number, string> {
	const result = new Map<number, string>();
	if (clusters.length === 0) return result;

	const numClusters = clusters.length;
	const usedLabels = new Set<string>();
	if (reservedLabels) {
		for (const label of reservedLabels) {
			usedLabels.add(label.toLowerCase());
		}
	}

	// 1. Cross-cluster document frequency (df) for full normalized tags AND multi-level root segments
	const tagClusterFreq = new Map<string, number>();
	const rootClusterFreq = new Map<string, number>();
	const clusterTagNoteCounts = new Map<number, Map<string, { raw: string; count: number }>>();

	for (const c of clusters) {
		const perClusterCounts = new Map<string, { raw: string; count: number }>();
		const clusterSeenTags = new Set<string>();
		const clusterSeenRoots = new Set<string>();

		for (const note of c.coreNotes) {
			const noteUnique = new Map<string, string>();
			for (const t of note.tags ?? []) {
				const normalized = t.replace(/^#+/, "").trim();
				if (!normalized) continue;
				const key = normalized.toLowerCase();
				if (!noteUnique.has(key)) {
					noteUnique.set(key, normalized);
				}
			}

			for (const [key, raw] of noteUnique.entries()) {
				const prev = perClusterCounts.get(key);
				if (prev) {
					prev.count += 1;
				} else {
					perClusterCounts.set(key, { raw, count: 1 });
				}
				clusterSeenTags.add(key);

				const slashIdx = key.indexOf("/");
				if (slashIdx > 0) {
					clusterSeenRoots.add(key.slice(0, slashIdx));
				}
			}
		}

		clusterTagNoteCounts.set(c.clusterId, perClusterCounts);
		for (const key of clusterSeenTags) {
			tagClusterFreq.set(key, (tagClusterFreq.get(key) ?? 0) + 1);
		}
		for (const rootKey of clusterSeenRoots) {
			rootClusterFreq.set(rootKey, (rootClusterFreq.get(rootKey) ?? 0) + 1);
		}
	}

	// 2. Cross-cluster title token frequency for tagless or exhausted clusters
	const titleTokenClusterFreq = new Map<string, number>();
	const clusterTitleTokens = new Map<number, Map<string, { raw: string; count: number }>>();

	for (const c of clusters) {
		const perClusterTokens = new Map<string, { raw: string; count: number }>();
		const clusterSeen = new Set<string>();

		for (const note of c.coreNotes) {
			const seenInTitle = new Set<string>();
			for (const tok of extractTitleTokens(note.title)) {
				const key = tok.toLowerCase();
				if (seenInTitle.has(key)) continue;
				seenInTitle.add(key);

				const prev = perClusterTokens.get(key);
				if (prev) {
					prev.count += 1;
				} else {
					perClusterTokens.set(key, { raw: tok, count: 1 });
				}
				clusterSeen.add(key);
			}
		}

		clusterTitleTokens.set(c.clusterId, perClusterTokens);
		for (const key of clusterSeen) {
			titleTokenClusterFreq.set(key, (titleTokenClusterFreq.get(key) ?? 0) + 1);
		}
	}

	// 3. Score tag candidates per cluster and sort globally/locally to pick best distinct labels
	interface TagCandidate {
		label: string;
		score: number;
	}

	const clusterBestTagCandidates = new Map<number, TagCandidate[]>();

	for (const c of clusters) {
		const counts = clusterTagNoteCounts.get(c.clusterId);
		const noteTotal = Math.max(1, c.coreNotes.length);
		const candidates: TagCandidate[] = [];

		if (counts) {
			for (const [key, entry] of counts.entries()) {
				const label = extractTagLeafLabel(entry.raw);
				if (!label) continue;

				const df = tagClusterFreq.get(key) ?? 1;
				const tf = entry.count / noteTotal;
				const idf = numClusters > 1 ? Math.log((numClusters + 1) / (df + 0.5)) : 1;
				const metaPenalty = numClusters >= 3 && df / numClusters >= 0.6 ? 0.15 : 1;
				const slashIdx = key.indexOf("/");
				const rootDf = slashIdx > 0 ? (rootClusterFreq.get(key.slice(0, slashIdx)) ?? df) : df;
				const maxIdf = numClusters > 1 ? Math.log((numClusters + 1) / 1.5) : 1;
				const rootIdf = numClusters > 1 ? Math.log((numClusters + 1) / (rootDf + 0.5)) : 1;
				const rootFactor = maxIdf > 0 ? 0.5 + 0.5 * Math.max(0, Math.min(1, rootIdf / maxIdf)) : 1;
				const charPenalty = Array.from(label).length <= 1 ? 0.4 : 1;

				candidates.push({
					label,
					score: tf * idf * metaPenalty * rootFactor * charPenalty,
				});
			}
		}

		candidates.sort((a, b) => b.score - a.score);
		clusterBestTagCandidates.set(c.clusterId, candidates);
	}

	// Assign clusters with strongest distinct tag signals first so specialized clusters claim their exact tag
	const clusterOrder = [...clusters].sort((a, b) => {
		const topA = clusterBestTagCandidates.get(a.clusterId)?.[0]?.score ?? 0;
		const topB = clusterBestTagCandidates.get(b.clusterId)?.[0]?.score ?? 0;
		return topB - topA;
	});

	for (const c of clusterOrder) {
		const tagCandidates = clusterBestTagCandidates.get(c.clusterId) ?? [];
		let chosen = "";

		for (const cand of tagCandidates) {
			const lower = cand.label.toLowerCase();
			if (!usedLabels.has(lower)) {
				chosen = cand.label;
				usedLabels.add(lower);
				break;
			}
		}

		// Fallback to repeated/distinctive title keywords
		if (!chosen) {
			const tokenMap = clusterTitleTokens.get(c.clusterId);
			if (tokenMap && tokenMap.size > 0) {
				const noteTotal = Math.max(1, c.coreNotes.length);
				const tokenCands: TagCandidate[] = [];

				for (const [key, entry] of tokenMap.entries()) {
					const df = titleTokenClusterFreq.get(key) ?? 1;
					const tf = entry.count / noteTotal;
					const idf = numClusters > 1 ? Math.log((numClusters + 1) / (df + 0.5)) : 1;
					const repeatBoost = entry.count >= 2 ? 1.8 : 1;
					const lenBoost = Array.from(entry.raw).length >= 2 ? 1 : 0.5;
					tokenCands.push({
						label: sanitizeDomainLabel(entry.raw),
						score: tf * idf * repeatBoost * lenBoost,
					});
				}

				tokenCands.sort((a, b) => b.score - a.score);
				for (const cand of tokenCands) {
					if (!cand.label) continue;
					const lower = cand.label.toLowerCase();
					if (!usedLabels.has(lower)) {
						chosen = cand.label;
						usedLabels.add(lower);
						break;
					}
				}
			}
		}

		// Fallback to cleaned first note title
		if (!chosen && c.coreNotes[0]?.title) {
			const cleanTitle = sanitizeDomainLabel(
				c.coreNotes[0].title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9 ]/g, " ").trim()
			);
			if (cleanTitle && !usedLabels.has(cleanTitle.toLowerCase())) {
				chosen = cleanTitle;
				usedLabels.add(cleanTitle.toLowerCase());
			}
		}

		if (!chosen) {
			chosen = locale === "en" ? `Peak ${c.clusterId + 1}` : `领域 ${c.clusterId + 1}`;
			usedLabels.add(chosen.toLowerCase());
		}

		result.set(c.clusterId, chosen);
	}

	return result;
}

function extractErrorDetailFromBody(rawBody: string): string {
	const trimmed = rawBody.trim();
	if (!trimmed) return "";
	try {
		const parsed = JSON.parse(trimmed) as ChatCompletionPayload;
		const msg = parsed?.error?.message ?? parsed?.message;
		if (typeof msg === "string" && msg.trim()) {
			return msg.trim().slice(0, 200);
		}
	} catch {
		// Fall back to raw text snippet
	}
	return trimmed.slice(0, 200);
}

function readDeltaText(val: unknown): string {
	return typeof val === "string" ? val : "";
}

export class LLMSynthesizer {
	private settings: KnowledgeMapSettings;
	private readonly fetchFn: typeof fetch | undefined;
	private readonly requestUrlFn: typeof requestUrl;
	private readonly connectTimeoutMs: number;
	private readonly idleTimeoutMs: number;
	private readonly totalTimeoutMs: number;
	private readonly fallbackTimeoutMs: number;
	private readonly testConnectTimeoutMs: number;
	private readonly testIdleTimeoutMs: number;
	private activeRequest: ActiveRequestHandle | null = null;

	constructor(settings: KnowledgeMapSettings, options: LLMSynthesizerOptions = {}) {
		this.settings = settings;
		this.fetchFn = options.fetchFn ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
		this.requestUrlFn = options.requestUrlFn ?? requestUrl;
		this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
		this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
		this.totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
		this.fallbackTimeoutMs = options.fallbackTimeoutMs ?? DEFAULT_FALLBACK_TIMEOUT_MS;
		this.testConnectTimeoutMs = options.testConnectTimeoutMs ?? DEFAULT_TEST_CONNECT_TIMEOUT_MS;
		this.testIdleTimeoutMs = options.testIdleTimeoutMs ?? DEFAULT_TEST_IDLE_TIMEOUT_MS;
	}

	updateSettings(settings: KnowledgeMapSettings): void {
		this.settings = settings;
	}

	cancel(): void {
		if (this.activeRequest) {
			this.activeRequest.cancel();
			this.activeRequest = null;
		}
	}

	private buildEndpoint(): string {
		const baseUrl = this.settings.llmBaseUrl.trim().replace(/\/+$/, "");
		return `${baseUrl}/chat/completions`;
	}

	private buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.settings.llmApiKey.trim()) {
			headers["Authorization"] = `Bearer ${this.settings.llmApiKey.trim()}`;
		}
		return headers;
	}

	private formatTimeoutMessage(category: LLMFailureCategory, sec: number, locale: "zh" | "en"): string {
		if (locale === "en") {
			if (category === "connect-timeout") return `Connection timed out (${sec}s) before receiving response`;
			if (category === "stream-idle-timeout") return `Stream stalled with no new chunks for ${sec}s`;
			if (category === "total-timeout") return `Total request time exceeded ${sec}s`;
			return `Request cancelled`;
		}
		if (category === "connect-timeout") return `建连/首包超时 (${sec}s)，请检查接口地址或网络`;
		if (category === "stream-idle-timeout") return `流式传输中途卡死（超过 ${sec}s 无新数据）`;
		if (category === "total-timeout") return `总生成耗时超过上限 (${sec}s)`;
		return "任务已取消";
	}

	private formatProgressText(
		phase: LLMPhase,
		model: string | undefined,
		thinkingChars: number,
		contentChars: number,
		elapsedMs: number,
		locale: "zh" | "en"
	): string {
		const sec = Math.max(1, Math.round(elapsedMs / 1000));
		const modelLabel = model || this.settings.llmModelName || "LLM";
		if (locale === "en") {
			if (phase === "connecting") return "Connecting to LLM service...";
			if (phase === "fallback-request") return "CORS restricted; switching to compatibility request mode...";
			if (phase === "thinking") return `Model ${modelLabel} thinking (${thinkingChars} chars · ${sec}s)...`;
			if (phase === "generating") return `Model ${modelLabel} generating summit names (${contentChars} chars · ${sec}s)...`;
			return "Summit naming finished";
		}
		if (phase === "connecting") return "正在连接大模型服务...";
		if (phase === "fallback-request") return "检测到跨域限制，切换兼容模式请求大模型...";
		if (phase === "thinking") return `模型 ${modelLabel} 思考中（已生成 ${thinkingChars} 字 · ${sec}s）...`;
		if (phase === "generating") return `模型 ${modelLabel} 正在输出山峰命名（${contentChars} 字 · ${sec}s）...`;
		return "山峰命名完成";
	}

	private async requestViaObsidianFallback(
		endpoint: string,
		headers: Record<string, string>,
		bodyObj: Record<string, unknown>,
		locale: "zh" | "en",
		startMs: number,
		onProgress?: (evt: LLMProgressEvent) => void
	): Promise<TransportOutput> {
		onProgress?.({
			phase: "fallback-request",
			model: this.settings.llmModelName || undefined,
			elapsedMs: Date.now() - startMs,
			thinkingChars: 0,
			contentChars: 0,
			message: this.formatProgressText("fallback-request", undefined, 0, 0, Date.now() - startMs, locale),
		});

		let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
		let rejectCancel: ((err: Error) => void) | null = null;
		let cancelled = false;

		this.activeRequest = {
			cancel: () => {
				cancelled = true;
				rejectCancel?.(new LLMRequestError("cancelled", this.formatTimeoutMessage("cancelled", 0, locale)));
			},
		};

		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutId = globalThis.setTimeout(() => {
				const sec = Math.round(this.fallbackTimeoutMs / 1000);
				reject(new LLMRequestError("total-timeout", this.formatTimeoutMessage("total-timeout", sec, locale)));
			}, this.fallbackTimeoutMs);
		});

		const cancelPromise = new Promise<never>((_, reject) => {
			rejectCancel = reject;
		});

		try {
			const reqPromise = this.requestUrlFn({
				url: endpoint,
				method: "POST",
				headers,
				body: JSON.stringify({ ...bodyObj, stream: false }),
				throw: false,
			});

			const response = await Promise.race([reqPromise, timeoutPromise, cancelPromise]);
			if (cancelled) {
				throw new LLMRequestError("cancelled", this.formatTimeoutMessage("cancelled", 0, locale));
			}

			if (response.status !== 200) {
				const detail = extractErrorDetailFromBody(response.text ?? "");
				throw new LLMRequestError(
					"http-error",
					detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`
				);
			}

			let payload: ChatCompletionPayload | null = null;
			try {
				payload = (response.json as ChatCompletionPayload | null) ?? (response.text ? JSON.parse(response.text) as ChatCompletionPayload : null);
			} catch {
				throw new LLMRequestError("parse-error", locale === "en" ? "Invalid JSON response from server" : "接口返回非合法 JSON");
			}

			const choice = payload?.choices?.[0];
			const msg = choice?.message;
			const content = readDeltaText(msg?.content);
			const reasoning = readDeltaText(msg?.reasoning_content) || readDeltaText(msg?.reasoning) || readDeltaText(msg?.thinking);
			const totalMs = Date.now() - startMs;

			return {
				model: payload?.model,
				content,
				reasoning,
				usedStreaming: false,
				isReasoningModel: reasoning.length > 0 || /<think>/i.test(content),
				ttfbMs: totalMs,
				totalMs,
			};
		} catch (err: unknown) {
			if (err instanceof LLMRequestError) throw err;
			const msg = err instanceof Error ? err.message : String(err);
			throw new LLMRequestError("network-error", msg);
		} finally {
			if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
			this.activeRequest = null;
		}
	}

	private async executeChatCompletion(
		bodyObj: Record<string, unknown>,
		locale: "zh" | "en",
		opts: {
			connectTimeoutMs: number;
			idleTimeoutMs: number;
			totalTimeoutMs: number;
			earlyStopForProbe?: boolean;
		},
		onProgress?: (evt: LLMProgressEvent) => void
	): Promise<TransportOutput> {
		const endpoint = this.buildEndpoint();
		const headers = this.buildHeaders();
		const startMs = Date.now();

		if (!this.fetchFn) {
			return await this.requestViaObsidianFallback(endpoint, headers, bodyObj, locale, startMs, onProgress);
		}

		const abortController = new AbortController();
		let abortReason: LLMFailureCategory | null = null;
		let headersReceived = false;
		let firstChunkReceived = false;
		let earlyProbeComplete = false;
		let model: string | undefined;
		let contentText = "";
		let reasoningText = "";
		let ttfbMs: number | undefined;
		let usedStreaming = false;
		let isReasoningModel = false;

		let connectTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
		let idleTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
		let totalTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
		let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

		const resetIdleTimer = () => {
			if (idleTimer !== undefined) globalThis.clearTimeout(idleTimer);
			idleTimer = globalThis.setTimeout(() => {
				if (abortReason === null) {
					abortReason = "stream-idle-timeout";
					abortController.abort();
				}
			}, opts.idleTimeoutMs);
		};

		this.activeRequest = {
			cancel: () => {
				if (abortReason === null) {
					abortReason = "cancelled";
					abortController.abort();
				}
			},
		};

		let lastPhase: LLMPhase = "connecting";
		let lastEmitMs = 0;
		const emitProgress = (phase: LLMPhase, force = false) => {
			if (!onProgress) return;
			const now = Date.now();
			if (!force && phase === lastPhase && now - lastEmitMs < PROGRESS_THROTTLE_MS) {
				return;
			}
			lastPhase = phase;
			lastEmitMs = now;
			const elapsedMs = now - startMs;
			const inlineThinkMatch = contentText.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
			const inlineThinkChars = inlineThinkMatch ? inlineThinkMatch[1].length : 0;
			const thinkingChars = reasoningText.length + inlineThinkChars;
			const visibleContentChars = stripThinkBlocks(contentText).cleaned.length;

			onProgress({
				phase,
				model: model || this.settings.llmModelName || undefined,
				elapsedMs,
				thinkingChars,
				contentChars: visibleContentChars,
				message: this.formatProgressText(phase, model, thinkingChars, visibleContentChars, elapsedMs, locale),
			});
		};

		connectTimer = globalThis.setTimeout(() => {
			if (abortReason === null) {
				abortReason = "connect-timeout";
				abortController.abort();
			}
		}, opts.connectTimeoutMs);

		totalTimer = globalThis.setTimeout(() => {
			if (abortReason === null) {
				abortReason = "total-timeout";
				abortController.abort();
			}
		}, opts.totalTimeoutMs);

		emitProgress("connecting", true);

		try {
			const res = await this.fetchFn(endpoint, {
				method: "POST",
				headers,
				signal: abortController.signal,
				body: JSON.stringify({ ...bodyObj, stream: true }),
			});

			headersReceived = true;

			if (!res.ok) {
				if (connectTimer !== undefined) {
					globalThis.clearTimeout(connectTimer);
					connectTimer = undefined;
				}
				const rawErr = await res.text().catch(() => "");
				const detail = extractErrorDetailFromBody(rawErr);
				throw new LLMRequestError(
					"http-error",
					detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`
				);
			}

			const contentType = (res.headers.get("content-type") || "").toLowerCase();

			// Handle providers that ignore stream:true and return regular JSON
			if (!contentType.includes("text/event-stream") || !res.body) {
				if (connectTimer !== undefined) {
					globalThis.clearTimeout(connectTimer);
					connectTimer = undefined;
				}
				resetIdleTimer();
				const rawText = await res.text();
				ttfbMs = Date.now() - startMs;
				let payload: ChatCompletionPayload;
				try {
					payload = JSON.parse(rawText) as ChatCompletionPayload;
				} catch {
					throw new LLMRequestError("parse-error", locale === "en" ? "Invalid JSON response from server" : "接口返回非合法 JSON");
				}
				const msg = payload?.choices?.[0]?.message;
				const content = readDeltaText(msg?.content);
				const reasoning = readDeltaText(msg?.reasoning_content) || readDeltaText(msg?.reasoning) || readDeltaText(msg?.thinking);
				emitProgress("done", true);
				return {
					model: payload?.model,
					content,
					reasoning,
					usedStreaming: false,
					isReasoningModel: reasoning.length > 0 || /<think>/i.test(content),
					ttfbMs,
					totalMs: Date.now() - startMs,
				};
			}

			usedStreaming = true;
			reader = res.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let lineBuffer = "";
			let streamEnded = false;

			const processLine = (rawLine: string) => {
				const trimmed = rawLine.trim();
				if (!trimmed || trimmed.startsWith(":")) return;
				if (!trimmed.startsWith("data:")) return;

				const dataStr = trimmed.slice(5).trim();
				if (dataStr === "[DONE]") {
					streamEnded = true;
					return;
				}

				let chunk: ChatCompletionPayload;
				try {
					chunk = JSON.parse(dataStr) as ChatCompletionPayload;
				} catch {
					return;
				}

				if (typeof chunk.model === "string" && chunk.model.trim()) {
					model = chunk.model.trim();
				}

				const choice = chunk.choices?.[0];
				const delta = choice?.delta ?? choice?.message;
				if (!delta) return;

				const dReasoning =
					readDeltaText(delta.reasoning_content) ||
					readDeltaText(delta.reasoning) ||
					readDeltaText(delta.thinking);
				const dContent = readDeltaText(delta.content);

				if (dReasoning) {
					reasoningText += dReasoning;
					isReasoningModel = true;
				}
				if (dContent) {
					contentText += dContent;
					if (/<think>/i.test(contentText)) {
						isReasoningModel = true;
					}
				}

				const openIdx = contentText.toLowerCase().lastIndexOf("<think>");
				const closeIdx = contentText.toLowerCase().lastIndexOf("</think>");
				const inInlineThink = openIdx !== -1 && openIdx > closeIdx;
				const visibleLen = stripThinkBlocks(contentText).cleaned.length;

				if (inInlineThink || (dReasoning && visibleLen === 0)) {
					emitProgress("thinking", lastPhase !== "thinking");
				} else if (visibleLen > 0 || dContent) {
					emitProgress("generating", lastPhase !== "generating");
				}

				if (opts.earlyStopForProbe) {
					const inlineThinkMatch = contentText.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
					const totalReasoningChars = reasoningText.length + (inlineThinkMatch ? inlineThinkMatch[1].length : 0);
					if (visibleLen > 0 || totalReasoningChars >= 12) {
						earlyProbeComplete = true;
						abortController.abort();
						streamEnded = true;
					}
				}
			};

			while (!streamEnded) {
				const { done, value } = await reader.read();
				if (done) break;

				if (!firstChunkReceived) {
					firstChunkReceived = true;
					ttfbMs = Date.now() - startMs;
					if (connectTimer !== undefined) {
						globalThis.clearTimeout(connectTimer);
						connectTimer = undefined;
					}
				}
				resetIdleTimer();

				lineBuffer += decoder.decode(value, { stream: true });
				const lines = lineBuffer.split(/\r?\n/);
				lineBuffer = lines.pop() ?? "";
				for (const line of lines) {
					processLine(line);
					if (streamEnded) break;
				}
			}

			if (!streamEnded && lineBuffer.trim()) {
				processLine(lineBuffer);
			}

			emitProgress("done", true);

			return {
				model,
				content: contentText,
				reasoning: reasoningText,
				usedStreaming,
				isReasoningModel,
				ttfbMs: ttfbMs ?? (Date.now() - startMs),
				totalMs: Date.now() - startMs,
			};
		} catch (err: unknown) {
			if (earlyProbeComplete) {
				emitProgress("done", true);
				return {
					model,
					content: contentText,
					reasoning: reasoningText,
					usedStreaming,
					isReasoningModel,
					ttfbMs: ttfbMs ?? (Date.now() - startMs),
					totalMs: Date.now() - startMs,
				};
			}

			if (err instanceof LLMRequestError) {
				throw err;
			}

			if (abortReason !== null) {
				const timeoutMs =
					abortReason === "connect-timeout"
						? opts.connectTimeoutMs
						: abortReason === "stream-idle-timeout"
						? opts.idleTimeoutMs
						: opts.totalTimeoutMs;
				throw new LLMRequestError(
					abortReason,
					this.formatTimeoutMessage(abortReason, Math.round(timeoutMs / 1000), locale)
				);
			}

			// Fetch failed before receiving headers (typical CORS block in Electron) -> fall back to Obsidian requestUrl
			if (!headersReceived) {
				console.warn("[Knowledge Map] fetch 流式建连受限，自动切换 Obsidian requestUrl 兼容请求:", err);
				return await this.requestViaObsidianFallback(endpoint, headers, bodyObj, locale, startMs, onProgress);
			}

			const msg = err instanceof Error ? err.message : String(err);
			throw new LLMRequestError("network-error", msg);
		} finally {
			if (connectTimer !== undefined) globalThis.clearTimeout(connectTimer);
			if (idleTimer !== undefined) globalThis.clearTimeout(idleTimer);
			if (totalTimer !== undefined) globalThis.clearTimeout(totalTimer);
			if (reader) {
				try {
					await reader.cancel();
				} catch {
					// Ignore reader close errors
				}
			}
			this.activeRequest = null;
		}
	}

	async testConnection(): Promise<TestConnectionResult> {
		const locale = resolveLocale(this.settings.locale);

		if (!this.settings.llmBaseUrl.trim()) {
			return {
				success: false,
				message: locale === "en" ? "Please fill in the LLM Server URL." : "请填写山峰命名服务地址。",
				failureCategory: "not-configured",
			};
		}
		if (!this.settings.llmModelName.trim()) {
			return {
				success: false,
				message: locale === "en" ? "Please fill in the LLM Model Name." : "请填写山峰命名模型名称。",
				failureCategory: "not-configured",
			};
		}

		try {
			const out = await this.executeChatCompletion(
				{
					model: this.settings.llmModelName.trim(),
					messages: [
						{ role: "system", content: "You are a helpful assistant." },
						{ role: "user", content: "Ping! Please respond with 'OK'." },
					],
					max_tokens: 128,
				},
				locale,
				{
					connectTimeoutMs: this.testConnectTimeoutMs,
					idleTimeoutMs: this.testIdleTimeoutMs,
					totalTimeoutMs: Math.max(this.testConnectTimeoutMs, 30_000),
					earlyStopForProbe: true,
				}
			);

			const modelName = out.model || this.settings.llmModelName.trim();
			const ttfbSec = ((out.ttfbMs ?? out.totalMs) / 1000).toFixed(1);
			const cleanContent = stripThinkBlocks(out.content).cleaned;

			if (!cleanContent && !out.reasoning.trim()) {
				return {
					success: false,
					model: modelName,
					ttfbMs: out.ttfbMs,
					isReasoningModel: out.isReasoningModel,
					usedStreaming: out.usedStreaming,
					failureCategory: "empty-response",
					message:
						locale === "en"
							? `Model ${modelName} returned an empty response (${ttfbSec}s).`
							: `模型 ${modelName} 返回内容为空（耗时 ${ttfbSec}s）。`,
				};
			}

			let message: string;
			if (locale === "en") {
				if (out.isReasoningModel && !cleanContent) {
					message = `Model ${modelName} connected (TTFB ${ttfbSec}s, reasoning model detected)`;
				} else if (out.isReasoningModel) {
					message = `Model ${modelName} connected (TTFB ${ttfbSec}s, reasoning model, reply: ${cleanContent.slice(0, 40)})`;
				} else {
					message = `Model ${modelName} connected (TTFB ${ttfbSec}s, reply: ${cleanContent.slice(0, 40)})`;
				}
			} else {
				if (out.isReasoningModel && !cleanContent) {
					message = `模型 ${modelName} 已连通（首包 ${ttfbSec}s，识别为思考模型）`;
				} else if (out.isReasoningModel) {
					message = `模型 ${modelName} 已连通（首包 ${ttfbSec}s，思考模型，响应: ${cleanContent.slice(0, 40)}）`;
				} else {
					message = `模型 ${modelName} 已连通（首包 ${ttfbSec}s，响应: ${cleanContent.slice(0, 40)}）`;
				}
			}

			return {
				success: true,
				message,
				model: modelName,
				ttfbMs: out.ttfbMs,
				isReasoningModel: out.isReasoningModel,
				usedStreaming: out.usedStreaming,
			};
		} catch (err: unknown) {
			const category = err instanceof LLMRequestError ? err.category : "network-error";
			const msg = err instanceof Error ? err.message : String(err);
			return {
				success: false,
				failureCategory: category,
				message: msg,
			};
		}
	}

	private buildPrompts(clusters: ClusterSample[], locale: "zh" | "en"): { systemPrompt: string; userPrompt: string } {
		const clusterDescriptions = clusters
			.map((c) => {
				const noteLines = c.coreNotes
					.slice(0, 6)
					.map((n) => {
						const tagPart = n.tags && n.tags.length > 0 ? ` [标签: #${n.tags.join(" #")}]` : "";
						const snippetPart = n.snippet
							? ` | 导语: ${n.snippet.slice(0, 45).replace(/\s+/g, " ").trim()}...`
							: "";
						return `  • 《${n.title}》${tagPart}${snippetPart}`;
					})
					.join("\n");

				return `【山峰 #${c.clusterId + 1}】(包含 ${c.notesCount} 篇笔记):\n${noteLines || "  (暂无代表笔记)"}`;
			})
			.join("\n\n");

		if (locale === "en") {
			const systemPrompt = `You are a senior taxonomy expert naming thematic mountain peaks for a user's Obsidian Knowledge Topography map.

[Task]
Based on each peak's representative note titles, tags, and snippets, synthesize a concise, high-information domain label for every cluster.

[Strict Rules]
1. Length: concise 1–3 words (or 2–4 Chinese characters if notes are primarily Chinese).
2. Specificity: use concrete disciplines, crafts, topics, or research domains (e.g., "Cognitive Science", "Quantitative Finance", "LLM Systems", "Specialty Coffee").
3. Negative constraints: avoid vague filler labels like "Misc Notes", "Personal Thoughts", "Daily Notes", or "Reading Clips".
4. Output format: strictly return a valid JSON array with no extra prose.

[Example]
Output:
[
  {"id": 1, "domain": "Specialty Coffee"}
]`;

			const userPrompt = `Here are the representative samples for each knowledge peak:\n\n${clusterDescriptions}\n\nOutput the strict JSON array for all peaks:`;
			return { systemPrompt, userPrompt };
		}

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

		return { systemPrompt, userPrompt };
	}

	async synthesizeDomains(
		clusters: ClusterSample[],
		onProgress?: (evt: LLMProgressEvent) => void
	): Promise<SynthesizeResult> {
		const startMs = Date.now();
		const locale = resolveLocale(this.settings.locale);

		if (clusters.length === 0) {
			return {
				domains: new Map<number, string>(),
				source: "llm",
				usedStreaming: false,
				isReasoningModel: false,
				totalMs: 0,
				llmCount: 0,
				fallbackCount: 0,
			};
		}

		const hasKey = Boolean(this.settings.llmApiKey.trim());
		const hasUrl = Boolean(this.settings.llmBaseUrl.trim());
		if (!hasUrl || (!hasKey && !isLocalEndpoint(this.settings.llmBaseUrl))) {
			const fallbackMap = buildFallbackDomains(clusters, locale);
			return {
				domains: fallbackMap,
				source: "fallback",
				usedStreaming: false,
				isReasoningModel: false,
				totalMs: Date.now() - startMs,
				llmCount: 0,
				fallbackCount: clusters.length,
				failureCategory: "not-configured",
				failureMessage: locale === "en" ? "LLM API key not configured" : "未配置大模型 API Key",
			};
		}

		const { systemPrompt, userPrompt } = this.buildPrompts(clusters, locale);
		const validIds = new Set(clusters.map((c) => c.clusterId));

		let transportOut: TransportOutput | null = null;
		let failureCategory: LLMFailureCategory | undefined;
		let failureMessage: string | undefined;

		try {
			transportOut = await this.executeChatCompletion(
				{
					model: this.settings.llmModelName.trim(),
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: userPrompt },
					],
					temperature: 0.2,
				},
				locale,
				{
					connectTimeoutMs: this.connectTimeoutMs,
					idleTimeoutMs: this.idleTimeoutMs,
					totalTimeoutMs: this.totalTimeoutMs,
				},
				onProgress
			);
		} catch (err: unknown) {
			failureCategory = err instanceof LLMRequestError ? err.category : "network-error";
			failureMessage = err instanceof Error ? err.message : String(err);

			if (failureCategory === "cancelled") {
				return {
					domains: new Map<number, string>(),
					source: "fallback",
					usedStreaming: false,
					isReasoningModel: false,
					totalMs: Date.now() - startMs,
					llmCount: 0,
					fallbackCount: clusters.length,
					failureCategory: "cancelled",
					failureMessage,
				};
			}
			console.warn("[Knowledge Map] LLM 山峰总结异常:", failureCategory, failureMessage);
		}

		const llmDomains = new Map<number, string>();
		let isReasoningModel = transportOut?.isReasoningModel ?? false;

		if (transportOut) {
			const parsed = parseDomainsFromContent(transportOut.content, validIds, locale);
			if (parsed.hadThinkBlock) isReasoningModel = true;

			for (const [id, domain] of parsed.map.entries()) {
				llmDomains.set(id, domain);
			}

			if (parsed.error === "empty") {
				failureCategory = "empty-response";
				failureMessage = locale === "en" ? "LLM returned empty content" : "模型返回内容为空";
			} else if (parsed.error === "parse") {
				failureCategory = "parse-error";
				failureMessage = locale === "en" ? "Failed to parse JSON array from LLM output" : "模型输出未能解析为有效 JSON 数组";
			} else if (llmDomains.size < clusters.length) {
				failureCategory = "parse-error";
				failureMessage =
					locale === "en"
						? `LLM returned ${llmDomains.size}/${clusters.length} peaks`
						: `模型仅返回 ${llmDomains.size}/${clusters.length} 座山峰名称`;
			}
		}

		const missingClusters = clusters.filter((c) => !llmDomains.has(c.clusterId));
		const merged = new Map<number, string>(llmDomains);

		if (missingClusters.length > 0) {
			const reserved = new Set<string>(llmDomains.values());
			const fallbackMap = buildFallbackDomains(clusters, locale, reserved);
			for (const c of missingClusters) {
				const fb = fallbackMap.get(c.clusterId);
				if (fb) merged.set(c.clusterId, fb);
			}
		}

		const llmCount = llmDomains.size;
		const fallbackCount = clusters.length - llmCount;
		const source: SynthesizeResult["source"] =
			fallbackCount === 0 ? "llm" : llmCount > 0 ? "partial-fallback" : "fallback";

		return {
			domains: merged,
			source,
			model: transportOut?.model || this.settings.llmModelName.trim() || undefined,
			usedStreaming: transportOut?.usedStreaming ?? false,
			isReasoningModel,
			ttfbMs: transportOut?.ttfbMs,
			totalMs: Date.now() - startMs,
			llmCount,
			fallbackCount,
			failureCategory,
			failureMessage,
		};
	}
}
