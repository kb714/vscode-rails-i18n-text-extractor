import * as vscode from 'vscode';
import FileProcessor from './fileProcessor';
import I18nFinder from '../utils/i18nFinder';
import UserInput from '../utils/userInput';

export default class RubyFileProcessor extends FileProcessor {
    private i18nFinder : I18nFinder;

    constructor(editor: vscode.TextEditor) {
        super(editor);
        this.i18nFinder = new I18nFinder();
    }

    async processText(): Promise<void> {
        const selectedText = this.selectedText;
        if (!selectedText) {
            vscode.window.showInformationMessage("No text selected", "Information");
            return;
        }

        
        const yamlPath = this.buildYamlPath();
        const { transformedText, variablesMap } = this.transformTextForI18nOnRuby(selectedText)
        const textToYaml = this.removeSurroundingQuotes(transformedText);

        // Buscar si el texto ya existe en los YML base
        const existingKey = this.i18nFinder.keyForText(textToYaml);

        if (existingKey) {
            const replacementText = this.buildI18nCall(existingKey, variablesMap);
            this.replaceSelectedText(replacementText);
        } else {
            const userInput = await UserInput.requestYmlKey();
            if (userInput) {
                const i18nTranslationPath = this.buildI18nPath(userInput);
                this.updateOrCreateYaml(yamlPath, i18nTranslationPath, textToYaml);
                const replacementText = this.buildI18nCall(i18nTranslationPath, variablesMap);
                this.replaceSelectedText(replacementText);
            }
        }
    }
}
