export type EmbeddingMode = "local-path" | "openai-api";

export type LocaleMode = "auto" | "zh" | "en";

export interface KnowledgeMapSettings {
	locale: LocaleMode;
	embeddingMode: EmbeddingMode;
	localModelPath: string;
	apiBaseUrl: string;
	apiKey: string;
	embeddingModelName: string;
	llmBaseUrl: string;
	llmApiKey: string;
	llmModelName: string;
	excludedFolders: string;
	currentTheme: string;
	maxCharsPerNote: number;
	contourLevels: number;
}

export const DEFAULT_SETTINGS: KnowledgeMapSettings = {
	locale: "auto",
	embeddingMode: "openai-api",
	localModelPath: "",
	apiBaseUrl: "https://api.openai.com/v1",
	apiKey: "",
	embeddingModelName: "text-embedding-3-small",
	llmBaseUrl: "https://api.openai.com/v1",
	llmApiKey: "",
	llmModelName: "gpt-4o-mini",
	excludedFolders: "_templates, _attachments, .obsidian, .trash, .git",
	currentTheme: "shanshui",
	maxCharsPerNote: 200,
	contourLevels: 32,
};

export interface NoteItem {
	path: string;
	title: string;
	folder: string;
	mtime: number;
	size: number;
	contentSnippet: string;
	tags?: string[];
}

export interface CachedEmbedding {
	path: string;
	title: string;
	folder?: string;
	mtime: number;
	vector: number[];
}

export interface Point2D {
	path: string;
	title: string;
	folder: string;
	x: number;
	y: number;
	clusterId: number;
	tags?: string[];
	snippet?: string;
}

export interface PeakCluster {
	id: number;
	x: number;
	y: number;
	density: number;
	domain: string;
	badge: string;
	notes: Point2D[];
}

export interface ThemeConfig {
	id: string;
	name: string;
	bgColor: string;
	inkColor: string;
	secondaryColor: string;
	accentColor: string;
	contourLevels: number;
	contourAlpha: number;
	contourLineAlpha: number;
	contourLineWidth: number;
	cmapColors: string[];
	plotlyColorscale: [number, string][];
	scatterPalette: string[];
	scatterEdgeColor: string;
	fontFamily: string;
	peakMarkers: string[];
	peakBadgeType: "stamp" | "crosshair" | "star" | "swiss_box" | "zen_circle" | "roman_circle" | "hud_dot";
	brandTitleFormat: string;
	brandSubtitle: string;
	htmlCustomCss: string;
	hasGridPattern?: boolean;
	isDark?: boolean;
}

export interface MapData {
	points: Point2D[];
	clusters: PeakCluster[];
	densityGrid: number[][];
	gridWidth: number;
	gridHeight: number;
	gridBounds: [number, number];
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	timestamp: number;
	htmlContent?: string;
}
