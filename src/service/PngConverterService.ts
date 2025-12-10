import { BaseConverterService } from './BaseConverterService';
import { FileDao, File } from "../dao/FileDao";
import { IMAGE_FILE_DESCRIPTION, DEFAULT_IMAGE_TEMPLATE } from "../utils/constants";
import { AttachmentParserService } from './AttachmentParserService';
import { TemplateService } from './TemplateService';
import { SettingsService } from './SettingsService';
import { Notice } from 'obsidian';

export class PngConverterService extends BaseConverterService {
    constructor(
        fileDao: FileDao,
        private parser: AttachmentParserService,
        private templateService: TemplateService,
        private settingsService: SettingsService
    ) {
        super(fileDao, {
            sourceExtension: '.png',
            targetExtension: '.png.md'
        });
    }

    protected async convertContent(source: File): Promise<string> {
        console.log(`[PngConverter] Processing ${source.name}`);

        const content = await this.parser.parseAttachmentContent(source.sizeInMB, () => source.getBinaryContent(), source.path);

        // Load template (user custom or fallback)
        const template = await this.templateService.loadTemplate(
            this.settingsService.pngTemplatePath,
            DEFAULT_IMAGE_TEMPLATE
        );

        // Prepare template variables
        const variables = {
            title: source.name.replace(/\.png$/i, ''),
            filename: source.name,
            extracted_content: content,
            description: IMAGE_FILE_DESCRIPTION,
            date: new Date().toISOString().split('T')[0],
            size: `${source.sizeInBytes} bytes`,
            path: source.path
        };

        // Substitute variables in template
        return this.templateService.substituteVariables(template, variables);
    }

    override async convertFiles(): Promise<void> {
        if (!this.parser.validateApiKey()) {
            console.warn('[PngConverter] No Google API key configured - PNG image parsing will be skipped');
            new Notice('⚠️ Google API key not configured. PNG files will not be indexed.\n\nPlease add your API key in plugin settings to enable image processing.', 8000);
            return;
        }
        await super.convertFiles();
    }
} 