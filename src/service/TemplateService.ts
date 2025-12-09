import { FileDao } from "../dao/FileDao";

export interface TemplateVariables {
	title: string;
	filename: string;
	extracted_content: string;
	description: string;
	date?: string;
	size?: string;
	path?: string;
}

export interface TemplateService {
	loadTemplate(templatePath: string, fallbackTemplate: string): Promise<string>;
	substituteVariables(template: string, variables: TemplateVariables): string;
}

export class TemplateServiceImpl implements TemplateService {
	constructor(private fileDao: FileDao) {}

	async loadTemplate(templatePath: string, fallbackTemplate: string): Promise<string> {
		try {
			// Try to load the user's custom template
			const templateContent = await this.fileDao.readFile(templatePath);
			if (templateContent) {
				return templateContent;
			}
		} catch (error) {
			console.log(`Template not found at ${templatePath}, using default template`);
		}

		// Return fallback if custom template doesn't exist or fails to load
		return fallbackTemplate;
	}

	substituteVariables(template: string, variables: TemplateVariables): string {
		let result = template;

		// Replace all {{variable}} placeholders with actual values
		for (const [key, value] of Object.entries(variables)) {
			if (value !== undefined) {
				const regex = new RegExp(`{{${key}}}`, 'g');
				result = result.replace(regex, value);
			}
		}

		return result;
	}
}
