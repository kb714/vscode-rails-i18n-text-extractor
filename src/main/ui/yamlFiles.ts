import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';

interface I18nValueDetail {
    value: string;
    filePath: string;
}

export default class YamlFiles {
    private i18nValues: Map<string, I18nValueDetail> = new Map();
    private isLoaded = false;

    constructor(private _: vscode.ExtensionContext) {
        this.loadI18nFiles();
    }

    async findDataFromKey(key: string): Promise<I18nValueDetail | undefined> {
        return this.i18nValues.get(key);
    }

    async refresh() {
        this.i18nValues.clear();
        await this.loadI18nFiles();
    }

    public async loadI18nFiles() {
        this.isLoaded = false;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
    
        for (const folder of workspaceFolders) {
            await this.searchForLocalesDirectory(folder.uri.fsPath);
        }
        this.isLoaded = true;
    }
    
    private async searchForLocalesDirectory(dirPath: string) {
        // esto es super lento ...
        try {
            const uri = vscode.Uri.file(dirPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);
            const searchPromises = [];
    
            for (const [entryName, entryType] of entries) {
                const fullPath = path.join(dirPath, entryName);
                if (entryType === vscode.FileType.Directory) {
                    // esto hay que dejarlo configurado, puede
                    // que no todos usen esta estructura
                    if (fullPath.endsWith('config/locales')) {
                        searchPromises.push(this.parseDirectory(fullPath));
                    } else {
                        searchPromises.push(this.searchForLocalesDirectory(fullPath));
                    }
                }
            }
    
            // esperamos que todo se complete
            await Promise.all(searchPromises);
        } catch (e) {
            console.error(`Error searching locales directory: ${dirPath}`, e);
        }
    }      

    public async waitForLoad(): Promise<void> {
        if (this.isLoaded) return Promise.resolve();
        return new Promise(resolve => {
            const checkLoaded = setInterval(() => {
                if (this.isLoaded) {
                    clearInterval(checkLoaded);
                    resolve();
                }
            }, 100);
        });
    }

    private async parseDirectory(dirPath: string) {
        try {
            const uri = vscode.Uri.file(dirPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);
            for (const [entryName, entryType] of entries) {
                // buscamos todos los que sean 'es' algo
                // esto debería beber ed la configuración de "idioma base"
                if (entryType === vscode.FileType.File && /^es.*\.yml$/.test(entryName)) {
                    await this.parseYamlFile(path.join(dirPath, entryName));
                } else if (entryType === vscode.FileType.Directory) {
                    await this.parseDirectory(path.join(dirPath, entryName));
                }
            }
        } catch (e) {
            console.error(`Error parsing directory: ${dirPath}`, e);
        }
    }

    private async parseYamlFile(filePath: string) {
        try {
            const uri = vscode.Uri.file(filePath);
            const fileContent = await vscode.workspace.fs.readFile(uri);
            const content = yaml.load(fileContent.toString());
            this.parseYamlContent('', content, filePath);
        } catch (e) {
            console.error(`Error parsing YAML file: ${filePath}`, e);
        }
    }

    private async parseYamlContent(prefix: string, content: any, filePath: string): Promise<void> {
        if (typeof content === 'object' && content !== null) {
            for (const [key, value] of Object.entries(content)) {
                const newPrefix = prefix ? `${prefix}.${key}` : key;
                await this.parseYamlContent(newPrefix, value, filePath);
            }
        } else if (typeof content === 'string') {
            this.i18nValues.set(prefix, { value: content, filePath: filePath });
        }
    }
}
