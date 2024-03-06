import * as vscode from 'vscode';
import FileProcessorFactory from './fileProcessorFactory';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.extract', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
			// no sé en que casos puede pasar esto, pero otras extensiones hacen lo mismo
            vscode.window.showInformationMessage('No hay editor activo');
            return;
        }

		const filePath = editor.document.uri.fsPath;
		const parts = filePath.split('.');
		const fileExtension = parts[parts.length - 1];

        // Pedimos la clave ... podríamos generar una automaticamente, pero quedaría no bueno
		const userInput = await vscode.window.showInputBox({
			placeHolder: "Clave para yml",
			prompt: "Escribe la Clave que se usará para la extracción, sin espacios ni puntuación",
			validateInput: text => {
				return text.trim().length === 0 ? 'Debes ingresar una clave' : null;
			}
		});

		if (userInput) {
			const processor = FileProcessorFactory.getProcessor(editor, userInput, fileExtension);

            if (processor) {
                processor.processText();
                vscode.window.showInformationMessage(`Texto procesado para ${fileExtension}`);
            } else {
                vscode.window.showInformationMessage('Tipo de archivo no soportado para extracción');
            }

		}
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
