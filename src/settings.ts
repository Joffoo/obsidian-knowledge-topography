import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import KnowledgeMapPlugin from "./main";

export class KnowledgeMapSettingTab extends PluginSettingTab {
	private plugin: KnowledgeMapPlugin;

	constructor(app: App, plugin: KnowledgeMapPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("knowledge-map-settings");

		// Header
		containerEl.createEl("h2", { text: "知识地图 (Knowledge Map) 设置" });

		// Section 1: Embedding Provider
		containerEl.createEl("h3", { text: "1. 向量嵌入计算 (Embedding)" });

		new Setting(containerEl)
			.setName("计算模式")
			.setDesc("选择使用本地 ONNX 模型直接推理，或调用云端/本地 API 服务")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("local-path", "本地 ONNX 模型文件 (离线私密)")
					.addOption("openai-api", "OpenAI 兼容 API (Ollama / 云端服务)")
					.setValue(this.plugin.settings.embeddingMode)
					.onChange(async (val) => {
						this.plugin.settings.embeddingMode = val as any;
						await this.plugin.saveSettings();
						this.display(); // Re-render conditionally
					});
			});

		if (this.plugin.settings.embeddingMode === "local-path") {
			new Setting(containerEl)
				.setName("本地模型目录绝对路径")
				.setDesc("指定本地 ONNX 模型的文件夹（需包含 model.onnx/model_quantized.onnx 及 tokenizer.json）")
				.addText((text) => {
					text
						.setPlaceholder("例如：E:/models/jina-embeddings-v2-base-zh")
						.setValue(this.plugin.settings.localModelPath)
						.onChange(async (val) => {
							this.plugin.settings.localModelPath = val.trim();
							await this.plugin.saveSettings();
						});
				});
		} else {
			new Setting(containerEl)
				.setName("API Base URL")
				.setDesc("嵌入服务接口地址（支持 OpenAI、Ollama、硅基流动等）")
				.addText((text) => {
					text
						.setPlaceholder("https://api.openai.com/v1")
						.setValue(this.plugin.settings.apiBaseUrl)
						.onChange(async (val) => {
							this.plugin.settings.apiBaseUrl = val.trim();
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("API Key")
				.setDesc("授权密钥（本地 Ollama 可留空）")
				.addText((text) => {
					text
						.setPlaceholder("sk-...")
						.setValue(this.plugin.settings.apiKey)
						.onChange(async (val) => {
							this.plugin.settings.apiKey = val.trim();
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("嵌入模型名称")
				.setDesc("调用的向量模型标识")
				.addText((text) => {
					text
						.setPlaceholder("text-embedding-3-small")
						.setValue(this.plugin.settings.embeddingModelName)
						.onChange(async (val) => {
							this.plugin.settings.embeddingModelName = val.trim();
							await this.plugin.saveSettings();
						});
				});
		}

		// Section 2: LLM Synthesis Provider
		containerEl.createEl("h3", { text: "2. 聚类领域归纳 (LLM API)" });
		containerEl.createEl("p", {
			text: "用于分析各知识山峰的核心笔记，智能总结 2~4 字的专业领域标签。单次生成仅需消耗几十 Token。",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("大模型 API Base URL")
			.setDesc("支持 OpenAI、DeepSeek、硅基流动、Ollama 等兼容接口")
			.addText((text) => {
				text
					.setPlaceholder("https://api.openai.com/v1")
					.setValue(this.plugin.settings.llmBaseUrl)
					.onChange(async (val) => {
						this.plugin.settings.llmBaseUrl = val.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("大模型 API Key")
			.setDesc("对应大模型的访问密钥")
			.addText((text) => {
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.llmApiKey)
					.onChange(async (val) => {
						this.plugin.settings.llmApiKey = val.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("大模型名称")
			.setDesc("调用的对话模型名称")
			.addText((text) => {
				text
					.setPlaceholder("gpt-4o-mini 或 deepseek-chat")
					.setValue(this.plugin.settings.llmModelName)
					.onChange(async (val) => {
						this.plugin.settings.llmModelName = val.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("测试大模型连接")
			.setDesc("验证大模型 API 地址、密钥及模型是否正常响应")
			.addButton((btn) => {
				btn.setButtonText("测试连接").onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText("正在连接...");
					const res = await this.plugin.llmSynthesizer.testConnection();
					btn.setDisabled(false);
					btn.setButtonText("测试连接");
					if (res.success) {
						new Notice(`✅ ${res.message}`);
					} else {
						new Notice(`❌ ${res.message}`, 6000);
					}
				});
			});

		// Section 3: Indexing and Filtering
		containerEl.createEl("h3", { text: "3. 笔记扫描与过滤" });

		new Setting(containerEl)
			.setName("排除文件夹")
			.setDesc("多个文件夹以英文逗号分隔，匹配的目录将被跳过")
			.addText((text) => {
				text
					.setPlaceholder("_templates, _attachments, .obsidian")
					.setValue(this.plugin.settings.excludedFolders)
					.onChange(async (val) => {
						this.plugin.settings.excludedFolders = val;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("单篇笔记最大截取字符")
			.setDesc("提取正文用于语义分析的前导字符数（推荐 150~250 字符，兼顾宏观主题精度与秒级推理速度）")
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.maxCharsPerNote))
					.onChange(async (val) => {
						const num = parseInt(val);
						if (!isNaN(num) && num >= 50) {
							this.plugin.settings.maxCharsPerNote = num;
							await this.plugin.saveSettings();
						}
					});
			});

		// Section 4: Cache Management
		containerEl.createEl("h3", { text: "4. 缓存与数据管理" });

		const cachedCount = this.plugin.cacheManager.size();
		new Setting(containerEl)
			.setName("已缓存向量")
			.setDesc(`当前已增量缓存 ${cachedCount} 篇笔记的嵌入向量。已有缓存的笔记在重新生成时无需重复请求。`)
			.addButton((btn) => {
				btn
					.setButtonText("清除所有缓存")
					.setWarning()
					.onClick(async () => {
						await this.plugin.cacheManager.clear();
						new Notice("已成功清空所有向量缓存！下次生成将全量重新计算。");
						this.display();
					});
			});
	}
}
