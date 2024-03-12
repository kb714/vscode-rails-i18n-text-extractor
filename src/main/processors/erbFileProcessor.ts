import * as vscode from 'vscode';
import FileProcessor from './fileProcessor';
import I18nFinder from '../utils/i18nFinder';
import UserInput from '../utils/userInput';

export default class ERBFileProcessor extends FileProcessor {
    private i18nFinder : I18nFinder;

    constructor(editor: vscode.TextEditor) {
        super(editor);
        this.i18nFinder = new I18nFinder();
    }

    async processText(): Promise<void> {
        const selectionRange = new vscode.Range(this.editor.selection.start, this.editor.selection.end);
        const selectedText = this.editor.document.getText(selectionRange);

        const yamlPath = this.buildYamlPath();
        const isWithinERBTags = this.isWithinERBTags(selectionRange);
        const { transformedText, variablesMap } = this.transformTextForI18n(selectedText, isWithinERBTags);
        const existingKey = this.i18nFinder.keyForText(transformedText);

        let i18nKey;

        if (existingKey) {
            i18nKey = existingKey;
        } else {
            const userInput = await UserInput.requestYmlKey();
            if (userInput) {
                i18nKey = this.buildI18nPath(userInput);
            } else {
                return;
            }
        }

        // Determinamos si el texto está en un bloque ruby
        // si hay mas casos aquí tendremos que agregarlos
        let textToFile;
        const replacementText = this.buildI18nCall(i18nKey, variablesMap);
        if (isWithinERBTags) {
            textToFile = replacementText;
        } else {
            textToFile = `<%= ${replacementText} %>`;
        }

        if (!existingKey) { 
            await this.updateOrCreateYaml(yamlPath, i18nKey, transformedText);
        }

        this.replaceSelectedText(textToFile);
    }

    private transformTextForI18n(originalText: string, isWithinERBTags: boolean): { transformedText: string, variablesMap: Map<string, string> } {
        if (isWithinERBTags) {
            const { transformedText, variablesMap } = this.transformTextForI18nOnRuby(originalText);
            const cleanedText = this.removeSurroundingQuotes(transformedText);
            return { transformedText: cleanedText, variablesMap };
        } else {
            return this.transformTextForI18nOnHTML(originalText);
        }
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
}
