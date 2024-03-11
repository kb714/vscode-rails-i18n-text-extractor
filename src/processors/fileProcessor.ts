import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

export default abstract class FileProcessor {
    protected editor: vscode.TextEditor;
    protected filePath: string;
    protected selectedText: string;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.filePath = editor.document.uri.fsPath;
        this.selectedText = editor.document.getText(editor.selection);
    }

    abstract processText(): Promise<void> | void;

    async replaceSelectedText(replacementText: string): Promise<void> {     
        await this.editor.edit(editBuilder => {
            editBuilder.replace(this.editor.selection, replacementText);
        });
    }

    protected buildI18nPath(userInput: string): string {
        const searchString = "/app/";
        const appIndex = this.filePath.indexOf(searchString);
        // Sacamos la parte de la ruta desde "app" en adelante y eliminamos la extensión del archivo
        // quizás sea bueno dejarlo configurable, es medio tricky ...
        const relevantPath = this.filePath.substring(appIndex + searchString.length, this.filePath.lastIndexOf("."));

        // Armamos el path con puntos
        const translationPath = relevantPath.replace(/\//g, '.');
    
        return `${translationPath}.${userInput}`;
    }

    protected buildYamlPath(): string {
        // Determina si el archivo está en un pack, configurar @.@
        // creo que packwerk no siempre deja las cosas en esta carpeta
        const isPack = this.filePath.includes("/packs/");
        let basePath: string;
        let relativePath: string;
    
        if (isPack) {
            // Extrae la ruta del pack desde 'filePath' y construye la base hasta 'config/locales'
            const packPath = this.filePath.split("/packs/")[1].split("/app/")[0];
            basePath = `${this.filePath.split("/packs/")[0]}/packs/${packPath}/config/locales`;
            relativePath = this.filePath.split("/app/")[1];
        } else {
            // Para archivos fuera de packs, construye la base usando 'config/locales'
            // Asume que la ruta del workspace ya es la raíz del proyecto por que vscode puede manejar varios
            // no tiene definición de "proyecto" como si lo tiene intellij
            // así que no sé si parte desde una carpeta dentro del proyecto, o desde la raiz ...
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const projectRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
            basePath = `${projectRoot}/config/locales`;
            relativePath = this.filePath.split("/app/")[1];
        }
    
        // configurar
        const locale = "es";
    
        const directoryPath = relativePath.substring(0, relativePath.lastIndexOf("/"));
        const fileName = `${relativePath.substring(relativePath.lastIndexOf("/") + 1).split(".")[0]}/${locale}.yml`;
    
        return `${basePath}/${directoryPath}/${fileName}`;
    }

    protected async updateOrCreateYaml(yamlPath: string, key: string, value: string) {
        const uri = vscode.Uri.file(yamlPath);
        let headerContent = "---\n";
        let yamlContent: any;
    
        try {
            const yamlTextFull = (await vscode.workspace.fs.readFile(uri)).toString();
    
            // js-yaml no tiene una configuración que se adapte a la forma en que manejamos los yml
            // en rails, así que forzamos un poco el comportamiento manteniendo el contenido
            // que existe antes de la primera clave del yml, si no hay nada, llenamos con ---
            // abrá que configurar esto de alguna manera ...
            const firstKeyIndex = yamlTextFull.search(/\w+:/);
            if (firstKeyIndex !== -1) {
                headerContent = yamlTextFull.substring(0, firstKeyIndex);
                if (!headerContent.trim()) {
                    headerContent = "---\n";
                }
            }
    
            const yamlText = yamlTextFull.substring(firstKeyIndex);
            yamlContent = yaml.load(yamlText) || {};
        } catch (error) {
            // Si el archivo no existe, creamos uno vacío
            yamlContent = {};
        }
    
        const lang = 'es';
        const full_key = [lang, key].join('.')
        this.updateYamlContent(yamlContent, full_key.split('.'), value);
    
        const newYamlText = headerContent + yaml.dump(yamlContent, {});
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(newYamlText));
    }    
    
    protected updateYamlContent(currentContent: any, keyParts: string[], value: string) {
        let currentLevel = currentContent;
    
        for (let i = 0; i < keyParts.length - 1; i++) {
            const part = keyParts[i];
            if (!currentLevel[part]) {
                currentLevel[part] = {};
            }
            currentLevel = currentLevel[part];
        }
    
        currentLevel[keyParts[keyParts.length - 1]] = value;
    }

    protected transformTextForI18nOnRuby(originalText: string): { transformedText: string, variablesMap: Map<string, string> } {
        let transformedText = originalText;
        const variablesMap = new Map<string, string>();
    
        const interpolationPattern = /#\{([^}]+)\}/g;
        transformedText = transformedText.replace(interpolationPattern, (_, fullExpression) => {
            fullExpression = fullExpression.trim();

            const isSimpleVariable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fullExpression);
    
            let slug = fullExpression;
            if (!isSimpleVariable) {
                slug = fullExpression
                .replace(/\([^)]*\)/g, '')
                .replace(/\[[^\]]*\]/g, '')
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '')
                .toLowerCase()
            }
    
            variablesMap.set(slug, fullExpression);
            return `%{${slug}}`;
        });
    
        return { transformedText, variablesMap };
    }

    protected transformTextForI18nOnHTML(originalText: string): { transformedText: string, variablesMap: Map<string, string> } {
        let transformedText = originalText;
        const variablesMap = new Map<string, string>();
    
        const erbPattern = /<%=?\s*([^%]+?)\s*%>/g;
        transformedText = transformedText.replace(erbPattern, (_, expression) => {
            expression = expression.trim();
    
            const isSimpleVariable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression);
    
            let slug = expression;
            if (!isSimpleVariable) {
                slug = expression
                    .replace(/\([^)]*\)/g, '')
                    .replace(/\[[^\]]*\]/g, '')
                    .replace(/[^a-zA-Z0-9_]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .toLowerCase();
            }
    
            variablesMap.set(slug, expression);
            return `%{${slug}}`;
        });
    
        return { transformedText, variablesMap };
    }

    protected buildI18nCall(i18nKey: string, variablesMap: Map<string, string>): string {
        const i18nArguments = Array.from(variablesMap.entries()).map(([slug, originalExpression]) => {
            if (originalExpression.includes('.')) {
                return `${slug}: ${originalExpression}`; // Para expresiones de clase
            } else {
                return `${slug}: ${slug}`; // Para variables dejamos igual
            }
        }).join(", ");
    
        const replacementText = variablesMap.size > 0 ? `I18n.t('${i18nKey}', ${i18nArguments})` : `I18n.t('${i18nKey}')`;

        return replacementText;
    }

    protected removeSurroundingQuotes(value: string): string {
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length - 1);
        } else {
            return value;
        }
    }  
}
