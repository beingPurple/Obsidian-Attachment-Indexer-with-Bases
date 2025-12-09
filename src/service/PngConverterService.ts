import { BaseConverterService } from './BaseConverterService';
import { FileDao, File } from "../dao/FileDao";
import { IMAGE_FILE_DESCRIPTION, DEFAULT_IMAGE_TEMPLATE } from "../utils/constants";
import { AttachmentParserService } from './AttachmentParserService';
import { TemplateService } from './TemplateService';
import { SettingsService } from './SettingsService';

export class PngConverterService extends BaseConverterService {
    constructor(
        fileDao: FileDao,
        indexFolder: string,
        private parser: AttachmentParserService,
        private templateService: TemplateService,
        private settingsService: SettingsService
    ) {
        super(fileDao, {
            indexFolder,
            sourceExtension: '.png',
            targetExtension: '.png.md'
        });
    }

    protected async convertContent(source: File): Promise<string> {
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
            console.warn('No Google API key configured - image parsing will be skipped');
            return;
        }
        await super.convertFiles();
    }
} 