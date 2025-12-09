import { BaseConverterService } from './BaseConverterService';
import { FileDao, File } from "../dao/FileDao";
import { PDF_FILE_DESCRIPTION, DEFAULT_PDF_TEMPLATE } from "../utils/constants";
import { AttachmentParserService } from './AttachmentParserService';
import { TemplateService } from './TemplateService';
import { SettingsService } from './SettingsService';
import { Notice } from 'obsidian';

export class PdfConverterService extends BaseConverterService {
    constructor(
        fileDao: FileDao,
        indexFolder: string,
        private parser: AttachmentParserService,
        private templateService: TemplateService,
        private settingsService: SettingsService
    ) {
        super(fileDao, {
            indexFolder,
            sourceExtension: '.pdf',
            targetExtension: '.pdf.md'
        });
    }

    protected async convertContent(source: File): Promise<string> {
        const content = await this.parser.parseAttachmentContent(source.sizeInMB, () => source.getBinaryContent(), source.path);

        // Load template (user custom or fallback)
        const template = await this.templateService.loadTemplate(
            this.settingsService.pdfTemplatePath,
            DEFAULT_PDF_TEMPLATE
        );

        // Prepare template variables
        const variables = {
            title: source.name.replace(/\.pdf$/i, ''),
            filename: source.name,
            extracted_content: content,
            description: PDF_FILE_DESCRIPTION,
            date: new Date().toISOString().split('T')[0],
            size: `${source.sizeInBytes} bytes`,
            path: source.path
        };

        // Substitute variables in template
        return this.templateService.substituteVariables(template, variables);
    }

    override async convertFiles(): Promise<void> {
        if (!this.parser.validateApiKey()) {
            console.warn('[PdfConverter] No Google API key configured - PDF parsing will be skipped');
            new Notice('⚠️ Google API key not configured. PDF files will not be indexed.\n\nPlease add your API key in plugin settings to enable PDF processing.', 8000);
            return;
        }
        await super.convertFiles();

    }
} 