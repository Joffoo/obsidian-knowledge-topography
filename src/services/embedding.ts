import { App, requestUrl } from "obsidian";
import { KnowledgeMapSettings, NoteItem } from "../types";

export interface EmbeddingProgressCallback {
	(current: number, total: number, message: string): void;
}

export class EmbeddingService {
	private app: App;
	private settings: KnowledgeMapSettings;
	private shouldCancel = false;
	private currentChildProcess: any = null;

	constructor(app: App, settings: KnowledgeMapSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: KnowledgeMapSettings): void {
		this.settings = settings;
	}

	cancel(): void {
		this.shouldCancel = true;
		if (this.currentChildProcess) {
			try {
				this.currentChildProcess.kill();
			} catch (e) {
				// Ignore process kill errors
			}
			this.currentChildProcess = null;
		}
	}

	async testConnection(): Promise<{ success: boolean; message: string; dim?: number }> {
		if (this.settings.embeddingMode === "local-path") {
			const fsModule = (window as any).require ? (window as any).require("fs") : null;
			if (!fsModule) return { success: false, message: "仅桌面端支持本地文件系统。" };
			if (!this.settings.localModelPath) return { success: false, message: "请先填写本地模型目录绝对路径。" };
			if (!fsModule.existsSync(this.settings.localModelPath)) return { success: false, message: `模型路径不存在: ${this.settings.localModelPath}` };
			return { success: true, message: "本地模型路径有效！" };
		}

		if (!this.settings.apiBaseUrl) {
			return { success: false, message: "请填写接口地址 (API Base URL)。" };
		}
		if (!this.settings.embeddingModelName) {
			return { success: false, message: "请填写模型名称 (Model Name)。" };
		}

		const baseUrl = this.settings.apiBaseUrl.replace(/\/+$/, "");
		const endpoint = `${baseUrl}/embeddings`;

		try {
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (this.settings.apiKey) {
				headers["Authorization"] = `Bearer ${this.settings.apiKey}`;
			}

			const response = await requestUrl({
				url: endpoint,
				method: "POST",
				headers: headers,
				body: JSON.stringify({
					input: ["Ping test"],
					model: this.settings.embeddingModelName,
				}),
				throw: false,
			});

			if (response.status !== 200) {
				let errDetail = "";
				try {
					if (response.json?.message) errDetail = `: ${response.json.message}`;
				} catch (e) {}
				if (!errDetail && response.text) errDetail = `: ${response.text.slice(0, 100)}`;
				return { success: false, message: `HTTP ${response.status}${errDetail}` };
			}

			const data = response.json;
			if (!data || !data.data || !Array.isArray(data.data) || !data.data[0]?.embedding) {
				return { success: false, message: `返回格式异常: ${JSON.stringify(data).slice(0, 150)}` };
			}

			const dim = data.data[0].embedding.length;
			return { success: true, message: `连接成功！向量维度: ${dim}`, dim };
		} catch (err: any) {
			return { success: false, message: `连接失败: ${err.message || err}` };
		}
	}

	async computeEmbeddings(
		notes: NoteItem[],
		onProgress?: EmbeddingProgressCallback
	): Promise<Map<string, number[]>> {
		this.shouldCancel = false;
		const results = new Map<string, number[]>();
		if (notes.length === 0) return results;

		if (this.settings.embeddingMode === "openai-api") {
			return await this.computeViaApi(notes, onProgress);
		} else {
			return await this.computeViaLocalPath(notes, onProgress);
		}
	}

	private async computeViaApi(
		notes: NoteItem[],
		onProgress?: EmbeddingProgressCallback
	): Promise<Map<string, number[]>> {
		const results = new Map<string, number[]>();
		const batchSize = 32;
		const total = notes.length;
		const baseUrl = this.settings.apiBaseUrl.replace(/\/+$/, "");
		const endpoint = `${baseUrl}/embeddings`;

		for (let i = 0; i < total; i += batchSize) {
			if (this.shouldCancel) {
				throw new Error("用户取消了计算任务。");
			}

			const batch = notes.slice(i, i + batchSize);
			const inputs = batch.map((n) => `${n.title}\n${n.contentSnippet}`);

			if (onProgress) {
				onProgress(i, total, `正在请求向量 API (${i + 1}~${Math.min(i + batchSize, total)}/${total})...`);
			}

			try {
				const headers: Record<string, string> = {
					"Content-Type": "application/json",
				};
				if (this.settings.apiKey) {
					headers["Authorization"] = `Bearer ${this.settings.apiKey}`;
				}

				const response = await requestUrl({
					url: endpoint,
					method: "POST",
					headers: headers,
					body: JSON.stringify({
						input: inputs,
						model: this.settings.embeddingModelName,
					}),
					throw: false,
				});

				if (response.status !== 200) {
					let errorDetail = "";
					try {
						const errJson = response.json;
						if (errJson?.message) errorDetail = ` (${errJson.message})`;
					} catch (e) {}
					if (!errorDetail && response.text) errorDetail = ` (${response.text.slice(0, 120)})`;
					throw new Error(`HTTP ${response.status}${errorDetail}`);
				}

				const data = response.json;
				if (!data || !data.data || !Array.isArray(data.data)) {
					throw new Error(`API 返回格式异常: ${JSON.stringify(data).slice(0, 200)}`);
				}

				for (let j = 0; j < batch.length; j++) {
					const itemData = data.data[j];
					if (itemData && itemData.embedding) {
						results.set(batch[j].path, itemData.embedding);
					}
				}
			} catch (err: any) {
				console.error("[Knowledge Map] API 嵌入失败:", err);
				throw new Error(`API 向量计算失败: ${err.message || err}`);
			}
		}

		if (onProgress) {
			onProgress(total, total, `向量计算完成 (${total}/${total})`);
		}
		return results;
	}

	private async computeViaLocalPath(
		notes: NoteItem[],
		onProgress?: EmbeddingProgressCallback
	): Promise<Map<string, number[]>> {
		const results = new Map<string, number[]>();
		let localPath = this.settings.localModelPath.trim().replace(/\\/g, "/");
		if (!localPath) {
			throw new Error("未配置本地模型路径！请在插件设置中指定包含 ONNX 模型的文件夹路径。");
		}

		// Resolve Node modules in Electron desktop
		const fsModule = (typeof window !== "undefined" && (window as any).require)
			? (window as any).require("fs")
			: (typeof require !== "undefined" ? require("fs") : null);
		const pathModule = (typeof window !== "undefined" && (window as any).require)
			? (window as any).require("path")
			: (typeof require !== "undefined" ? require("path") : null);
		const cpModule = (typeof window !== "undefined" && (window as any).require)
			? (window as any).require("child_process")
			: (typeof require !== "undefined" ? require("child_process") : null);

		if (!fsModule || !pathModule || !cpModule) {
			throw new Error("无法访问底层 Node.js 进程系统，请确认在 Obsidian 桌面端运行。");
		}

		if (!fsModule.existsSync(localPath)) {
			throw new Error(`指定的本地模型路径不存在: ${localPath}`);
		}

		const vaultAdapter = this.app.vault.adapter as any;
		const vaultBasePath = vaultAdapter.basePath || (vaultAdapter.getBasePath ? vaultAdapter.getBasePath() : "");
		const pluginDir = pathModule.join(vaultBasePath, ".obsidian", "plugins", "knowledge-topography");
		const runnerScript = pathModule.join(pluginDir, "local_runner.js");

		if (!fsModule.existsSync(runnerScript)) {
			throw new Error(`本地推理脚本丢失: ${runnerScript}`);
		}

		if (onProgress) {
			onProgress(0, notes.length, "正在初始化本地推理后台引擎...");
		}

		const tempInputFile = pathModule.join(pluginDir, `.tmp_infer_${Date.now()}.json`);
		const payload = {
			modelDir: localPath,
			pluginDir: pluginDir,
			notes: notes.map((n) => ({
				path: n.path,
				title: n.title,
				text: n.contentSnippet,
			})),
		};

		fsModule.writeFileSync(tempInputFile, JSON.stringify(payload), "utf8");

		return new Promise<Map<string, number[]>>((resolve, reject) => {
			let stderrData = "";
			let stdoutBuffer = "";

			const child = cpModule.spawn("node", [runnerScript, "--input", tempInputFile], {
				cwd: pluginDir,
				windowsHide: true,
				env: { ...process.env, NODE_NO_WARNINGS: "1" },
			});

			this.currentChildProcess = child;

			child.stdout.on("data", (chunk: any) => {
				stdoutBuffer += chunk.toString("utf8");
				const lines = stdoutBuffer.split("\n");
				stdoutBuffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					try {
						const msg = JSON.parse(trimmed);
						if (msg.type === "progress") {
							const remainMsg = msg.remainSec > 0 ? ` (预计剩余 ${msg.remainSec} 秒)` : "";
							if (onProgress) {
								onProgress(
									msg.current,
									msg.total,
									`本地推理中 (${msg.current}/${msg.total})${remainMsg}: ${msg.title}`
								);
							}
						} else if (msg.type === "vector") {
							results.set(msg.path, msg.vector);
						} else if (msg.type === "status") {
							if (onProgress) {
								onProgress(0, notes.length, msg.message);
							}
						}
					} catch (e) {
						// Ignore non-json logs
					}
				}
			});

			child.stderr.on("data", (chunk: any) => {
				stderrData += chunk.toString("utf8");
			});

			child.on("error", (err: any) => {
				this.currentChildProcess = null;
				try {
					if (fsModule.existsSync(tempInputFile)) fsModule.unlinkSync(tempInputFile);
				} catch (e) {}
				if (err.code === "ENOENT") {
					reject(new Error("系统未检测到 Node.js 运行时命令 (node)。请确认系统已安装 Node.js 或切换至 API 向量模式。"));
				} else {
					reject(new Error(`本地子进程启动失败: ${err.message || err}`));
				}
			});

			child.on("close", (code: number) => {
				this.currentChildProcess = null;
				try {
					if (fsModule.existsSync(tempInputFile)) fsModule.unlinkSync(tempInputFile);
				} catch (e) {}

				if (this.shouldCancel) {
					reject(new Error("用户取消了计算任务。"));
					return;
				}

				if (code !== 0) {
					let errDetail = stderrData.trim();
					try {
						const parsedErr = JSON.parse(errDetail);
						if (parsedErr.message) errDetail = parsedErr.message;
					} catch (e) {}
					reject(new Error(`本地模型推理失败 (退出码 ${code}): ${errDetail || "未知错误"}`));
					return;
				}

				if (onProgress) {
					onProgress(notes.length, notes.length, `本地推理完成 (${results.size}/${notes.length})`);
				}
				resolve(results);
			});
		});
	}
}
