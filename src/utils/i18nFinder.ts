import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

export default class I18nFinder {
    private i18nMaps: Map<string, any> = new Map();

    constructor() {
        this.loadYmlFiles();
    }

    public keyForText(text: string): string | null {
        for (const [, data] of this.i18nMaps) {
            const key = this.findKeyInObject(data, text);
            if (key) {
                // sé que es tricky, pero funciona
                // eliminamos el idioma de la key
                // por ahora no nos importa ... quizás tener un selector?
                const dotIndex = key.indexOf('.');
                return dotIndex !== -1 ? key.substring(dotIndex + 1) : key;
            }
        }

        return null;
    }

    public refresh() : void {
        this.loadYmlFiles();
    }

    private async loadYmlFiles() {
        const config = vscode.workspace.getConfiguration('i18nExtractor');
        const ymlFiles: string[] = config.get('baseYmlFiles', []);

        // Cargamos los archivos YML que tenemos en settings
        for (const filePath of ymlFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = yaml.load(content);
                this.i18nMaps.set(filePath, data);
            } catch (error) {
                console.error(`Error loading YML file ${filePath}:`, error);
            }
        }
    }

    private findKeyInObject(obj: any, target: string, prefix: string = ''): string | null {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = prefix ? `${prefix}.${key}` : key;
            // podríamos tener problemas en el case de recursividad ...
            if (value !== null && typeof value === 'object') {
                const result = this.findKeyInObject(value, target, currentPath);
                if (result) return result;
            } else if (value === target) {
                return currentPath;
            }
        }

        return null;
    }
}
