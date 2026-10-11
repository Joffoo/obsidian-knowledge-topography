import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import KnowledgeMapPlugin from "./main";
import { t } from "./i18n";
import { EmbeddingMode, LocaleMode } from "./types";

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

		const i18n = t(this.plugin.settings.locale);

		// Header
		new Setting(containerEl).setName(i18n.settings_title).setHeading();

		// Language Selector
		new Setting(containerEl)
			.setName(i18n.lang_name)
			.setDesc(i18n.lang_desc)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto", i18n.lang_auto)
					.addOption("zh", i18n.lang_zh)
					.addOption("en", i18n.lang_en)
					.setValue(this.plugin.settings.locale)
					.onChange(async (val) => {
						this.plugin.settings.locale = val as LocaleMode;
						await this.plugin.saveSettings();
						this.display(); // Re-render in the new language
					});
			});

		// Section 1: Topography Engine
		new Setting(containerEl).setName(i18n.sec_engine).setHeading();

		new Setting(containerEl)
			.setName(i18n.mode_name)
			.setDesc(i18n.mode_desc)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("openai-api", i18n.opt_api)
					.addOption("local-path", i18n.opt_local)
					.setValue(this.plugin.settings.embeddingMode)
					.onChange(async (val) => {
						this.plugin.settings.embeddingMode = val as EmbeddingMode;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.embeddingMode === "local-path") {
			new Setting(containerEl)
				.setName(i18n.local_path_name)
				.setDesc(i18n.local_path_desc)
				.addText((text) => {
					text
						.setPlaceholder(i18n.local_path_holder)
						.setValue(this.plugin.settings.localModelPath)
						.onChange(async (val) => {
							this.plugin.settings.localModelPath = val.trim();
							await this.plugin.saveSettings();
						});
				});
		} else {
			new Setting(containerEl)
				.setName(i18n.api_url_name)
				.setDesc(i18n.api_url_desc)
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
				.setName(i18n.api_key_name)
				.setDesc(i18n.api_key_desc)
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
				.setName(i18n.model_name)
				.setDesc(i18n.model_desc)
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

		new Setting(containerEl)
			.setName(i18n.test_name)
			.setDesc(i18n.test_desc)
			.addButton((btn) => {
				btn.setButtonText(i18n.test_btn).onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText(i18n.test_testing);
					const res = await this.plugin.embeddingService.testConnection();
					btn.setDisabled(false);
					btn.setButtonText(i18n.test_btn);
					if (res.success) {
						new Notice(`✅ ${res.message}`);
					} else {
						new Notice(`❌ ${res.message}`, 6000);
					}
				});
			});

		// Section 2: Peak Naming
		new Setting(containerEl)
			.setName(i18n.sec_peak)
			.setDesc(i18n.sec_peak_desc)
			.setHeading();

		new Setting(containerEl)
			.setName(i18n.llm_url_name)
			.setDesc(i18n.llm_url_desc)
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
			.setName(i18n.llm_key_name)
			.setDesc(i18n.llm_key_desc)
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
			.setName(i18n.llm_model_name)
			.setDesc(i18n.llm_model_desc)
			.addText((text) => {
				text
					.setPlaceholder("gpt-4o-mini / deepseek-chat")
					.setValue(this.plugin.settings.llmModelName)
					.onChange(async (val) => {
						this.plugin.settings.llmModelName = val.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(i18n.test_name)
			.setDesc(i18n.test_desc)
			.addButton((btn) => {
				btn.setButtonText(i18n.test_btn).onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText(i18n.test_testing);
					const res = await this.plugin.llmSynthesizer.testConnection();
					btn.setDisabled(false);
					btn.setButtonText(i18n.test_btn);
					if (res.success) {
						new Notice(`✅ ${i18n.test_ok}${res.message}`);
					} else {
						new Notice(`❌ ${i18n.test_fail}${res.message}`, 6000);
					}
				});
			});

		// Section 3: Scan Scope
		new Setting(containerEl).setName(i18n.sec_scan).setHeading();

		new Setting(containerEl)
			.setName(i18n.ignore_name)
			.setDesc(i18n.ignore_desc)
			.addText((text) => {
				text
					.setPlaceholder("_templates, _attachments")
					.setValue(this.plugin.settings.excludedFolders)
					.onChange(async (val) => {
						this.plugin.settings.excludedFolders = val;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(i18n.sample_name)
			.setDesc(i18n.sample_desc)
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

		// Section 4: Data Storage
		new Setting(containerEl).setName(i18n.sec_data).setHeading();

		const cachedCount = this.plugin.cacheManager.size();
		new Setting(containerEl)
			.setName(i18n.cache_name)
			.setDesc(i18n.cache_desc(cachedCount))
			.addButton((btn) => {
				btn
					.setButtonText(i18n.clear_btn)
					.setWarning()
					.onClick(async () => {
						await this.plugin.cacheManager.clear();
						new Notice(i18n.clear_notice);
						this.display();
					});
			});
	}
}
