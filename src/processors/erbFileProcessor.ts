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
    
        // para variables normales tipo <%= variable %>
        const rubyVariablePattern = /<%=?\s*([a-zA-Z_][\w.]*)\s*%>/g;
        transformedText = transformedText.replace(rubyVariablePattern, (_, variableName) => {
            if (!variablesMap.has(variableName)) {
                variablesMap.set(variableName, variableName);
            }

            return `%{${variableName}}`;
        });

        // para clases tipo <%= Foo.human_attribute_name(:bar) %>
        const classMethodPattern = /(?:<%=\s*|\#\{)([A-Z][\w:]*\w+)\.([a-zA-Z_]+)\(([^\}]*)\)(?:\s*%>|\})/g;
        transformedText = transformedText.replace(classMethodPattern, (_, classPath, methodName, methodArgs) => {
            const classPathSlug = classPath.replace(/::/g, "_").toLowerCase();
            const slug = `${classPathSlug}_${methodName}`;
            const originalExpression = methodArgs ? `${classPath}.${methodName}(${methodArgs})` : `${classPath}.${methodName}()`;
            variablesMap.set(slug, originalExpression);
            return `%{${slug}}`;
        });

        // acá ir agregando mas casos
    
        return { transformedText, variablesMap };
    }      
}
