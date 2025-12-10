import {App, Platform, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {SettingsService} from "../service/SettingsService";

export class SettingsTab extends PluginSettingTab {
	private settingsService: SettingsService;

	constructor(app: App, plugin: Plugin, settingsService: SettingsService) {
		super(app, plugin);
		this.settingsService = settingsService;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// Add comprehensive plugin description at the top
		const descriptionEl = containerEl.createEl('div', { cls: 'plugin-description' });
		
		descriptionEl.createEl('h2', { text: 'How This Plugin Works' });
		
		const mainDescription = descriptionEl.createEl('p');
		mainDescription.innerHTML = `This plugin creates and synchronizes searchable markdown index files for various attachment types in your vault. It extracts and indexes complete text content, enabling both full-text and content-based search (e.g., finding images by words like "Flowers" or "Receipt"). Index files are automatically removed when originals are deleted:
		<ul>
			<li><strong>Canvas files</strong> (.canvas): Converts canvas JSON into markdown format with links to nodes and groups</li>
			<li><strong>PDF files</strong> (.pdf): Creates markdown files with PDF viewer and extracts complete text content for searching (requires Google API key)</li>
			<li><strong>Image files</strong> (.png, .jpg, .jpeg): Creates markdown files with embedded images and extracts all visible text for searching (requires Google API key)</li>
		</ul>
		All indexed files are stored in the specified index folder with their original extension plus ".md" (e.g., file.canvas → index/file.canvas.md). The plugin maintains synchronization, updating index files when originals change and removing them when originals are deleted.`;

		new Setting(containerEl)
			.setName('Run on start')
			.setDesc('Automatically convert files when plugin loads')
			.addToggle(toggle => toggle
				.setValue(this.settingsService.runOnStart)
				.onChange(async (value) => {
					await this.settingsService.updateRunOnStart(value);
				}));

		new Setting(containerEl)
			.setName('Run on start (Mobile)')
			.setDesc('Automatically convert files when plugin loads on mobile devices. Separate from desktop setting to help prevent crashes. It is recommended to enable this only after initial indexation is complete, as the process could take up to several days for large vaults and might cause Obsidian to restart if big files are present.')
			.addToggle(toggle => toggle
				.setValue(this.settingsService.runOnStartMobile)
				.onChange(async (value) => {
					await this.settingsService.updateRunOnStartMobile(value);
				}));

		new Setting(containerEl)
			.setName('Google API Key')
			.setDesc(createFragment(el => {
				el.appendText('Without this key, only Canvas files will be indexed. While Gemini has daily limits, they are usually sufficient for free usage. PDFs and images will be indexed gradually over several hours. Get your key here: ');
				el.createEl('a', {
					href: 'https://aistudio.google.com/app/apikey',
					text: 'https://aistudio.google.com/app/apikey',
					cls: 'external-link'
				});
			}))
			.addText(text => {
				text.inputEl.type = 'password';
				text.setPlaceholder('Enter your Google API key')
					.setValue(this.settingsService.googleApiKey)
					.onChange(async (value) => {
						await this.settingsService.updateGoogleApiKey(value);
					});
			});

		// Template Settings Section
		containerEl.createEl('h3', { text: 'Template Settings' });

		const templateDescription = containerEl.createEl('p');
		templateDescription.innerHTML = `Configure custom templates for generated markdown files. If a template file is not found, the plugin will use a built-in fallback template. Templates support variables like {{title}}, {{filename}}, {{extracted_content}}, {{description}}, {{date}}, {{size}}, and {{path}}.`;

		new Setting(containerEl)
			.setName('PNG Template Path')
			.setDesc('Path to template for PNG files (e.g., Templates/Visual Note.md)')
			.addText(text => text
				.setPlaceholder('Templates/Visual Note.md')
				.setValue(this.settingsService.pngTemplatePath)
				.onChange(async (value) => {
					await this.settingsService.updatePngTemplatePath(value);
				}));

		new Setting(containerEl)
			.setName('JPEG Template Path')
			.setDesc('Path to template for JPEG files')
			.addText(text => text
				.setPlaceholder('Templates/Visual Note.md')
				.setValue(this.settingsService.jpegTemplatePath)
				.onChange(async (value) => {
					await this.settingsService.updateJpegTemplatePath(value);
				}));

		new Setting(containerEl)
			.setName('JPG Template Path')
			.setDesc('Path to template for JPG files')
			.addText(text => text
				.setPlaceholder('Templates/Visual Note.md')
				.setValue(this.settingsService.jpgTemplatePath)
				.onChange(async (value) => {
					await this.settingsService.updateJpgTemplatePath(value);
				}));

		new Setting(containerEl)
			.setName('PDF Template Path')
			.setDesc('Path to template for PDF files')
			.addText(text => text
				.setPlaceholder('Templates/Visual Note.md')
				.setValue(this.settingsService.pdfTemplatePath)
				.onChange(async (value) => {
					await this.settingsService.updatePdfTemplatePath(value);
				}));

		// Add Restore Defaults button
		new Setting(containerEl)
			.setName('Restore default settings')
			.setDesc('Reset all settings to their default values')
			.addButton(button => button
				.setButtonText('Restore defaults')
				.onClick(async () => {
					await this.settingsService.restoreDefaults();
					this.display(); // Refresh the settings UI
				}));
	}
}
