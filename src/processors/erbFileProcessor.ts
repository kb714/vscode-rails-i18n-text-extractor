import * as vscode from 'vscode';
import FileProcessor from './fileProcessor';

export default class ERBFileProcessor extends FileProcessor {

    constructor(editor: vscode.TextEditor, userInput: string) {
        super(editor, userInput);
    }

    async processText(): Promise<void> {
        const selectionRange = new vscode.Range(this.editor.selection.start, this.editor.selection.end);
        const selectedText = this.editor.document.getText(selectionRange);

        const i18nTranslationPath = this.buildI18nPath();
        const yamlPath = this.buildYamlPath();

        const isWithinERBTags = this.isWithinERBTags(selectionRange);
        
        let textToYaml;
        let finalReplacementText;

        // Determinamos si el texto está en un bloque ruby
        // si hay mas casos aquí tendremos que agregarlos
        if (isWithinERBTags) {
            // Dentro de <%= %>, básicamente lo tratamos como si fuera un archivo ruby
            const { transformedText, variablesMap } = this.transformTextForI18nOnRuby(selectedText);
            textToYaml = this.removeSurroundingQuotes(transformedText);
            const replacementText = this.buildI18nCall(i18nTranslationPath, variablesMap);

            finalReplacementText = replacementText;
        } else {
            // Texto plano, necesita ser envuelto en <%= %>
            const { transformedText, variablesMap } = this.transformTextForI18nOnHTML(selectedText);
            textToYaml = transformedText;
            const replacementText = this.buildI18nCall(i18nTranslationPath, variablesMap);

            finalReplacementText = `<%= ${replacementText} %>`;
        }

        this.replaceSelectedText(finalReplacementText);

        await this.updateOrCreateYaml(yamlPath, i18nTranslationPath, textToYaml);
    }

    private isWithinERBTags(selectionRange: vscode.Range): boolean {
        const textBeforeSelection = this.editor.document.getText(new vscode.Range(
            new vscode.Position(0, 0),
            selectionRange.start));

        // es medio tricky pero funciona, básicamente nos posicionamos en el texto seleccionado
        // y vamos viendo hacia atrás alguna apertura de <% o <%=
        const lastOpeningTagIndex = Math.max(textBeforeSelection.lastIndexOf("<%="), textBeforeSelection.lastIndexOf("<%"));

        // si no hay ninguna, es puro texto no ruby
        if (lastOpeningTagIndex === -1) {
            return false;
        }

        // si es que hay, buscamos alguna de cierre
        const lastClosingTagIndex = textBeforeSelection.lastIndexOf("%>");

        // si la última etiqueta de apertura esta después de la última etiqueta de cierre
        // la selección esta dentro de un bloque Ruby
        // acepto sugerencias ~(˘▾˘~)
        return lastOpeningTagIndex > lastClosingTagIndex;
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
}
