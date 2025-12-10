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
		console.log(`[TemplateService] Loading template from: ${templatePath}`);

		try {
			// Try to load the user's custom template
			const templateContent = await this.fileDao.readFile(templatePath);
			if (templateContent) {
				console.log(`[TemplateService] Custom template loaded successfully, length: ${templateContent.length} chars`);
				return templateContent;
			} else {
				console.log(`[TemplateService] Template file exists but is empty, using fallback`);
			}
		} catch (error) {
			console.log(`[TemplateService] Template not found at ${templatePath}, using default template`);
			console.log(`[TemplateService] Error details:`, error);
		}

		// Return fallback if custom template doesn't exist or fails to load
		console.log(`[TemplateService] Using fallback template, length: ${fallbackTemplate.length} chars`);
		return fallbackTemplate;
	}

	substituteVariables(template: string, variables: TemplateVariables): string {
		console.log(`[TemplateService] ========== TEMPLATE SUBSTITUTION START ==========`);
		console.log(`[TemplateService] Template BEFORE substitution:\n`, template);
		console.log(`[TemplateService] Variables to substitute:`, variables);

		let result = template;

		// Replace all {{variable}} placeholders with actual values
		for (const [key, value] of Object.entries(variables)) {
			if (value !== undefined) {
				const regex = new RegExp(`{{${key}}}`, 'g');
				const beforeReplace = result;
				result = result.replace(regex, value);

				// Log each substitution
				if (beforeReplace !== result) {
					console.log(`[TemplateService] ✓ Replaced {{${key}}} with: "${value}"`);
				} else {
					console.log(`[TemplateService] ⚠ No matches found for {{${key}}}`);
				}
			} else {
				console.log(`[TemplateService] ⚠ Skipping {{${key}}} - value is undefined`);
			}
		}

		console.log(`[TemplateService] Template AFTER substitution:\n`, result);
		console.log(`[TemplateService] ========== TEMPLATE SUBSTITUTION END ==========`);
		return result;
	}
}
