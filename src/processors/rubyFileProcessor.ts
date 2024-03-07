import * as vscode from 'vscode';
import FileProcessor from './fileProcessor';

export default class RubyFileProcessor extends FileProcessor {

    constructor(editor: vscode.TextEditor, userInput: string) {
        super(editor, userInput);
    }

    async processText(): Promise<void> {
        const i18nTranslationPath = this.buildI18nPath();
        const yamlPath = this.buildYamlPath();
        const { transformedText, variablesMap } = this.transformTextForI18nOnRuby(this.selectedText)
        const textToYaml = this.removeSurroundingQuotes(transformedText);

        const replacementText = this.buildI18nCall(i18nTranslationPath, variablesMap);

        this.replaceSelectedText(replacementText)

        this.updateOrCreateYaml(yamlPath, i18nTranslationPath, textToYaml)
    }  
}
