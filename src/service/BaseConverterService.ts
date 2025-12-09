import { File, FileDao } from "../dao/FileDao";
import { FatalProcessingError } from './AttachmentParserService';

export interface ConversionConfig {
    indexFolder: string;
    sourceExtension: string;
    targetExtension: string;
}

export abstract class BaseConverterService {
    constructor(
        protected fileDao: FileDao,
        protected config: ConversionConfig
    ) {}

    async convertFiles(): Promise<void> {
        console.log(`[BaseConverter] Starting conversion for ${this.config.sourceExtension} files`);
        console.log(`[BaseConverter] Index folder: ${this.config.indexFolder}`);

        try {
            console.log(`[BaseConverter] Creating index folder: ${this.config.indexFolder}`);
            await this.fileDao.createFolder(this.config.indexFolder);
            console.log(`[BaseConverter] Index folder created/verified successfully`);

            console.log(`[BaseConverter] Fetching all files from vault`);
            const allFiles = await this.fileDao.getFiles();
            console.log(`[BaseConverter] Total files in vault: ${allFiles.length}`);

            const sourceFiles = allFiles.filter(f => f.path.endsWith(this.config.sourceExtension));
            console.log(`[BaseConverter] Source files (${this.config.sourceExtension}): ${sourceFiles.length}`);
            console.log(`[BaseConverter] Source file paths:`, sourceFiles.map(f => f.path));

            const convertedFiles = allFiles.filter(f =>
                f.path.startsWith(`${this.config.indexFolder}/`) &&
                f.path.endsWith(this.config.targetExtension)
            );
            console.log(`[BaseConverter] Converted files (${this.config.targetExtension}): ${convertedFiles.length}`);

            console.log(`[BaseConverter] Starting parallel processing: remove orphaned, create new, modify existing`);
            const [removedFiles, createdFiles, modifiedFiles] = await Promise.all([
                this.removeOrphanedFiles(convertedFiles, sourceFiles),
                this.createConvertedFiles(sourceFiles, convertedFiles),
                this.modifyConvertedFiles(sourceFiles, convertedFiles),
            ]);

            this.logConversionResults(removedFiles, createdFiles, modifiedFiles, sourceFiles.length);
            console.log(`[BaseConverter] Conversion completed successfully for ${this.config.sourceExtension}`);
        } catch (error) {
            console.error(`[BaseConverter] Error during conversion for ${this.config.sourceExtension}:`, error);
            console.error(`[BaseConverter] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

            if (error instanceof FatalProcessingError) {
                throw error;
            }
        }
    }

    protected abstract convertContent(source: File): Promise<string>;

    protected getSourceName(file: File): string {
        return file.name.slice(0, -this.config.targetExtension.length) + this.config.sourceExtension;
    }

    protected getConvertedFilePath(sourceName: string): string {
        return `${this.config.indexFolder}/${sourceName.slice(0, -this.config.sourceExtension.length)}${this.config.targetExtension}`;
    }

    protected async removeOrphanedFiles(convertedFiles: File[], sourceFiles: File[]): Promise<string[]> {
        const sourceNames = new Set(sourceFiles.map(f => f.name));

        const removedFiles = convertedFiles
            .filter(convertedFile => !sourceNames.has(this.getSourceName(convertedFile)))
            .map(async convertedFile => {
                try {
                    await this.fileDao.deleteFile(convertedFile.path);
                    return convertedFile.path;
                } catch (error) {
                    console.error(`Failed to remove converted file ${convertedFile.path}:`, error);
                    return null;
                }
            });

        return (await Promise.all(removedFiles)).filter(Boolean) as string[];
    }

    protected async createConvertedFiles(sourceFiles: File[], convertedFiles: File[]): Promise<{
        count: number;
        files: string[]
    }> {
        const convertedNames = new Set(convertedFiles.map(f => this.getSourceName(f)));
        const newFiles = sourceFiles.filter(source => !convertedNames.has(source.name));

        console.log(`[BaseConverter] createConvertedFiles: ${newFiles.length} new files to create`);

        const processedNames = [];
        for (const source of newFiles) {
            try {
                const targetPath = this.getConvertedFilePath(source.name);
                console.log(`[BaseConverter] Creating new file: ${source.name} -> ${targetPath}`);
                await this.convertAndSave(source, targetPath);
                processedNames.push(source.name);
                console.log(`[BaseConverter] Successfully created: ${targetPath}`);
            } catch (error) {
                if (error instanceof FatalProcessingError) {
                    throw error;
                }
                console.error(`[BaseConverter] Error creating file ${source.name}:`, error);
            }
        }
        return { count: processedNames.length, files: processedNames };
    }

    protected async modifyConvertedFiles(sourceFiles: File[], convertedFiles: File[]): Promise<{
        count: number;
        files: string[]
    }> {
        const convertedFileMap = new Map(
            convertedFiles.map(convertedFile => [
                this.getSourceName(convertedFile),
                convertedFile
            ])
        );

        console.log(`[BaseConverter] modifyConvertedFiles: Checking ${sourceFiles.length} source files for updates`);

        const modifiedFileNames = [];
        for (const source of sourceFiles) {
            const convertedFile = convertedFileMap.get(source.name);
            if (convertedFile && source.modifiedTime >= convertedFile.modifiedTime) {
                try {
                    const targetPath = this.getConvertedFilePath(source.name);
                    console.log(`[BaseConverter] Updating modified file: ${source.name} -> ${targetPath}`);
                    await this.convertAndSave(source, targetPath);
                    modifiedFileNames.push(source.name);
                    console.log(`[BaseConverter] Successfully updated: ${targetPath}`);
                } catch (error) {
                    if (error instanceof FatalProcessingError) {
                        throw error;
                    }
                    console.error(`[BaseConverter] Error updating file ${source.name}:`, error);
                }
            }
        }

        console.log(`[BaseConverter] modifyConvertedFiles: ${modifiedFileNames.length} files updated`);
        return { count: modifiedFileNames.length, files: modifiedFileNames };
    }

    protected async convertAndSave(source: File, targetPath: string): Promise<void> {
        console.log(`[BaseConverter] convertAndSave: Starting conversion for ${source.path}`);
        console.log(`[BaseConverter] convertAndSave: Target path: ${targetPath}`);

        try {
            const convertedContent = await this.convertContent(source);
            console.log(`[BaseConverter] convertAndSave: Content converted, length: ${convertedContent.length} chars`);

            await this.fileDao.createOrUpdateFile(targetPath, convertedContent);
            console.log(`[BaseConverter] convertAndSave: File saved successfully to ${targetPath}`);
        } catch (error) {
            console.error(`[BaseConverter] convertAndSave: Error converting ${source.path}:`, error);
            throw error;
        }
    }

    protected logConversionResults(removedFiles: string[], createdFiles: {
        count: number;
        files: string[]
    }, modifiedFiles: { count: number; files: string[] }, totalFiles: number): void {
        console.log(
            `File conversion completed successfully\n` +
            `Total files processed ${createdFiles.count + modifiedFiles.count + removedFiles.length}/${totalFiles}\n` +
            `Created files ${createdFiles.count}\n` +
            (createdFiles.count > 0 ?
                `  ${createdFiles.files.map(f => `- ${f.replace(this.config.sourceExtension, '')}`).join('\n  ')}\n` : '') +
            `Modified files ${modifiedFiles.count}\n` +
            (modifiedFiles.count > 0 ?
                `  ${modifiedFiles.files.map(f => `- ${f.replace(this.config.sourceExtension, '')}`).join('\n  ')}\n` : '') +
            `Deleted files ${removedFiles.length}\n` +
            (removedFiles.length > 0 ?
                `  ${removedFiles.map(f => `- ${f.replace(`${this.config.indexFolder}/`, '').replace(this.config.targetExtension, '')}`).join('\n  ')}\n` : '')
        );
    }
} 