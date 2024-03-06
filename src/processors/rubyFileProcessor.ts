import * as vscode from 'vscode';
import FileProcessor from './fileProcessor';

export default class RubyFileProcessor extends FileProcessor {

    constructor(editor: vscode.TextEditor, userInput: string) {
        super(editor, userInput);
    }

    async processText(): Promise<void> {
        const i18nTranslationPath = this.buildI18nPath();
        const yamlPath = this.buildYamlPath();
        const { transformedText, variablesMap } = this.transformTextForI18n(this.selectedText)
        const textToYaml = this.removeSurroundingQuotes(transformedText);

        const replacementText = this.buildI18nCall(i18nTranslationPath, variablesMap);

        this.replaceSelectedText(replacementText)

        this.updateOrCreateYaml(yamlPath, i18nTranslationPath, textToYaml)
    }

    private transformTextForI18n(originalText: string): { transformedText: string, variablesMap: Map<string, string> } {
        let transformedText = originalText;
        const variablesMap = new Map<string, string>();
    
        // Detecta variables normales
        transformedText = transformedText.replace(/#\{([a-z_][^\}]+)\}/g, (_, variableName) => {
            variablesMap.set(variableName, variableName);
            return `%{${variableName}}`;
        });
    
        // Detecta clases ej: Foo.human_attribute_name(:bar)
        const classMethodPattern = /#\{([A-Z][\w:]*\w+)\.([a-zA-Z_]+)\(([^\}]*)\)\}/g;
        transformedText = transformedText.replace(classMethodPattern, (_, classPath, methodName, methodArgs) => {
            const classPathSlug = classPath.replace(/::/g, "_").toLowerCase();
            const slug = `${classPathSlug}_${methodName}`;
            const originalExpression = methodArgs ? `${classPath}.${methodName}(${methodArgs})` : `${classPath}.${methodName}()`;
            variablesMap.set(slug, originalExpression);
            return `%{${slug}}`;
        });

        // agregar mas casos acá
    
        return { transformedText, variablesMap };
    }

    private buildI18nCall(i18nKey: string, variablesMap: Map<string, string>): string {
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

    private removeSurroundingQuotes(value: string): string {
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length - 1);
        } else {
            return value;
        }
    }    
}
