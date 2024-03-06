import * as vscode from 'vscode';
import FileProcessor from './processors/fileProcessor';
import RubyTextProcessor from './processors/rubyFileProcessor';
import ERBTextProcessor from './processors/erbFileProcessor';

export default class FileProcessorFactory {
    static getProcessor(editor: vscode.TextEditor, userInput: string, fileExtension: string): FileProcessor | null {
        // acá registrar mas formatos
        switch (fileExtension) {
            case 'rb':
                return new RubyTextProcessor(editor, userInput);
            case 'erb':
                return new ERBTextProcessor(editor, userInput);
            default:
                return null;
        }
    }
}
