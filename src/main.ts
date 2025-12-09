import {Plugin, Notice} from 'obsidian';
import {CanvasService} from './service/CanvasService';
import {FileDaoImpl} from './dao/FileDaoImpl';
import {ObsidianFileAdapter} from './dao/ObsidianFileAdapter';
import {FileAdapter} from './dao/FileAdapter';
import {SettingsServiceImpl} from "./service/SettingsService";
import {SettingsTab} from './utils/SettingsTab';
import {PngConverterService} from './service/PngConverterService';
import {JpgConverterService} from './service/JpgConverterService';
import { JpegConverterService } from './service/JpegConverterService';
import { GeminiAttachmentParserService } from './service/AttachmentParserService';
import { PdfConverterService } from './service/PdfConverterService';
import { FatalProcessingError } from './service/AttachmentParserService';
import { Platform } from 'obsidian';
import { TemplateServiceImpl } from './service/TemplateService';

export default class ObsidianIndexer extends Plugin {
	private isConverting = false;

	override async onload() {
		// Initialize settings manager and load settings
		const settingsService = new SettingsServiceImpl(this);
		await settingsService.loadSettings();

		// Initialize dependencies
		const fileAdapter: FileAdapter = new ObsidianFileAdapter(this.app);
		const fileDao = new FileDaoImpl(fileAdapter);
		const templateService = new TemplateServiceImpl(fileDao);
		const canvasService = new CanvasService(fileDao, settingsService);

		// Create parser instances with specific prompts for each type
		const pdfParser = new GeminiAttachmentParserService(
			settingsService, 
			'application/pdf',
			"Extract and summarize the content of this PDF. Provide the complete text and a brief summary. If the PDF contains images, include descriptions of them and the full text they contain."
		);

		const pngParser = new GeminiAttachmentParserService(
			settingsService, 
			'image/png',
			"Extract and summarize the content of this image. Provide the complete text and a brief summary."
		);

		const jpgParser = new GeminiAttachmentParserService(
			settingsService, 
			'image/jpeg',
			"Extract and summarize the content of this image. Provide the complete text and a brief summary."
		);

		const jpegParser = new GeminiAttachmentParserService(
			settingsService, 
			'image/jpeg',
			"Extract and summarize the content of this image. Provide the complete text and a brief summary."
		);

		// Create converters
		const pdfConverter = new PdfConverterService(fileDao, settingsService.indexFolder, pdfParser, templateService, settingsService);
		const pngConverter = new PngConverterService(fileDao, settingsService.indexFolder, pngParser, templateService, settingsService);
		const jpgConverter = new JpgConverterService(fileDao, settingsService.indexFolder, jpgParser, templateService, settingsService);
		const jpegConverter = new JpegConverterService(fileDao, settingsService.indexFolder, jpegParser, templateService, settingsService);

		// Initialize converters and other services
		const runConversion = async () => {
			console.log('[ObsidianIndexer] ========== Starting conversion process ==========');

			if (this.isConverting) {
				console.log('[ObsidianIndexer] Conversion already in progress, aborting');
				new Notice('Conversion is already in progress. Please wait.');
				return;
			}

			this.isConverting = true;
			try {
				// Run converters sequentially
				console.log('[ObsidianIndexer] Running Canvas converter...');
				await canvasService.convertFiles();

				console.log('[ObsidianIndexer] Running PDF converter...');
				await pdfConverter.convertFiles();

				console.log('[ObsidianIndexer] Running PNG converter...');
				await pngConverter.convertFiles();

				console.log('[ObsidianIndexer] Running JPG converter...');
				await jpgConverter.convertFiles();

				console.log('[ObsidianIndexer] Running JPEG converter...');
				await jpegConverter.convertFiles();

				console.log('[ObsidianIndexer] All converters completed successfully');
				// Show success notification
				new Notice('All attachments have been processed successfully');
			} catch (error) {
				console.error('[ObsidianIndexer] Conversion process failed:', error);
				if (error instanceof FatalProcessingError) {
					// Show error notification
					new Notice('Processing stopped due to Gemini API errors. Please try again later.');
					console.error('[ObsidianIndexer] Fatal processing error:', error.message);
				} else {
					// Handle other errors
					new Notice('An error occurred during processing');
					console.error('[ObsidianIndexer] Conversion error:', error);
				}
			} finally {
				this.isConverting = false;
				console.log('[ObsidianIndexer] ========== Conversion process ended ==========');
			}
		};

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this, settingsService));

		// Add command for manual conversion
		this.addCommand({
			id: 'convert-canvas-files',
			name: 'Convert attachment files to Markdown',
			callback: async () => {
				await runConversion();
			},
		});

		// Schedule a delayed conversion if runOnStart is enabled
		const shouldAutoStart = Platform.isMobile 
			? settingsService.runOnStartMobile 
			: settingsService.runOnStart;

		if (shouldAutoStart) {
			this.app.workspace.onLayoutReady(() => {
				runConversion();
			});
		}
	}

	override onunload() {
		console.log('Obsidian Indexer plugin unloaded.');
	}
}
