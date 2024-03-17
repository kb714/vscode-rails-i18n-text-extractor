import * as vscode from 'vscode';
import * as fs from 'fs';
import * as readline from 'readline';
import HTML from '../utils/html';

export default class I18nInformationProvider implements vscode.WebviewViewProvider {
	constructor(public yamlManager: any, context: vscode.ExtensionContext) {
		this._context = context;
	}
	private _context: vscode.ExtensionContext;
	private webviewView?: vscode.WebviewView;

	public resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
		this.webviewView = webviewView;
		webviewView.webview.options = { enableScripts: true };

		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'goToDefinition') {
				const { position } = message;

				const document = await vscode.workspace.openTextDocument(position.filePath);
				const editor = await vscode.window.showTextDocument(document, { preview: false });
				
				// el 6 es para dejar el mouse en la t de I18n.t
				const newPosition = new vscode.Position(position.line, position.character + 6);
				const newSelection = new vscode.Selection(newPosition, newPosition);
				
				editor.selection = newSelection;
				await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
				editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenter);
			}

			if (message.command === 'goToYml') {
				const { position } = message;
				const line = await this.findLineOfKeyInYaml(position.filePath, position.fullKey);
				const openPath = vscode.Uri.file(position.filePath);
				const document = await vscode.workspace.openTextDocument(openPath);
				const editor = await vscode.window.showTextDocument(document, { preview: false });
			
				// movemos el raton al final de la linea y centramos
				if (line >= 0) {
					const linePosition = document.lineAt(line).range.end;
					editor.selection = new vscode.Selection(linePosition, linePosition);
					editor.revealRange(new vscode.Range(linePosition, linePosition), vscode.TextEditorRevealType.InCenter);
				}
			}
		}, undefined, this._context.subscriptions);

		this.updateWebview();
	}

	public async updateWebview() {
		if (this.webviewView) {
			const editor = vscode.window.activeTextEditor;
			if (editor && (editor.document.languageId === 'ruby' || editor.document.fileName.endsWith('.erb'))) {
				this.webviewView.webview.html = this.getHtmlForWebview(true, "");
				await this.yamlManager.waitForLoad();
				const keys = this.extractI18nKeys(editor.document);
				const filePath = editor.document.uri.fsPath;
				const tableRows = await this.generateTableRows(keys, filePath);
				this.webviewView.webview.html = this.getHtmlForWebview(false, tableRows);
			} else {
				this.webviewView.webview.html = this.getHtmlForWebview(false, "");
			}
		}
	}

	private extractI18nKeys(document: vscode.TextDocument): { key: string, position: vscode.Position }[] {
		const text = document.getText();
		const i18nRegex = /I18n\.t\(['"`](.*?)['"`]\)/g;
		let match;
		const keysWithPosition: { key: string, position: vscode.Position }[] = [];

		while ((match = i18nRegex.exec(text)) !== null) {
			if (match[1]) {
				// Guardamos también la posición para hacer un goToDefinition
				const position = document.positionAt(match.index);
				keysWithPosition.push({ key: match[1], position });
			}
		}

		return keysWithPosition;
	}

	private async generateTableRows(keys: { key: string; position: vscode.Position }[], filePath: string): Promise<string> {
		const rowsPromises = keys.map(async ({ key, position }) => {
			let fullKey;
			let ymlData;
			// deberíamos detectar las variantes del idioma base
			const langKeys = ['es', 'es-co', 'es-pe', 'es-mx', 'es-br'];
			for (let langKey of langKeys) {
				fullKey = `${langKey}.`.concat(key);
				ymlData = await this.yamlManager.findDataFromKey(fullKey);
				if (ymlData) {
					// salimos si encontramos un valor, podríamos tener un selector
					// para setear la prioridad de busqueda
					break;
				}
			}
			
			let value;
			let goToYmlHTML = "";
			if(ymlData) {
				value = HTML.escape(ymlData.value)
				const positionYml = JSON.stringify({ filePath: ymlData.filePath, fullKey: fullKey });
				goToYmlHTML = `
					<vscode-button appearance="icon" onclick="goToYml('${positionYml.replace(/"/g, '&quot;')}')">
						<i class="codicon codicon-code"></i>
					</vscode-button>
				`;
			} else {
				value = '<span style="color: var(--vscode-editorOverviewRuler-warningForeground)">not found</span>';
			}
			const positionString = JSON.stringify({ line: position.line, character: position.character, filePath: filePath });
			return `<vscode-data-grid-row>
				<vscode-data-grid-cell grid-column="1">${key}</vscode-data-grid-cell>
				<vscode-data-grid-cell grid-column="2">${value}</vscode-data-grid-cell>
				<vscode-data-grid-cell grid-column="3">
					${goToYmlHTML}
					<vscode-button appearance="icon" onclick="goToDefinition('${positionString.replace(/"/g, '&quot;')}')">
						<i class="codicon codicon-go-to-file"></i>
					</vscode-button>
				</vscode-data-grid-cell>
			</vscode-data-grid-row>`;
		});

		const rows = await Promise.all(rowsPromises);
		return rows.join('');
	}

	private getHtmlForWebview(showProgress: boolean, rows: string) {
		const toolkitUri = this.webviewView?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'toolkit.js'));
		const codiconsUri = this.webviewView?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'codicon.css'));
		let bodyContent = showProgress ?
			`<div style="display: flex; justify-content: center; align-items: center; height: 100%; margin-top: 20px">
					<vscode-progress-ring></vscode-progress-ring>
				</div>`
			: `<vscode-data-grid generate-header="sticky">
				<vscode-data-grid-row row-type="sticky-header">
					<vscode-data-grid-cell cell-type="columnheader" grid-column="1">Key</vscode-data-grid-cell>
					<vscode-data-grid-cell cell-type="columnheader" grid-column="2">Value</vscode-data-grid-cell>
				</vscode-data-grid-row>
				${rows}
			</vscode-data-grid>`;
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link href="${codiconsUri}" rel="stylesheet" />
			<script type="module" src="${toolkitUri}"></script>
		</head>
		<body>
			${bodyContent}
			<script>
				const vscode = acquireVsCodeApi();
				function goToDefinition(positionString) {
					const position = JSON.parse(positionString);
					vscode.postMessage({ command: 'goToDefinition', position });
				}

				function goToYml(positionYml) {
					const position = JSON.parse(positionYml);
					vscode.postMessage({ command: 'goToYml', position });
				}
			</script>
		</body>
		</html>`;
	}

	  private async findLineOfKeyInYaml(filePath: string, keyPath: string): Promise<number> {
		// Como no sabemos siempre como se identan las lineas, basicamente lo que hacemos
		// es buscar la primera anidación y contar las lineas que hay entre
		// ella y la siguiente clave, esa distancia será la separación que define
		// los espacios, acepto mejores soluciones <.<
        const fileStream = fs.createReadStream(filePath);
      
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });

        const keyParts = keyPath.split('.');
        let currentDepth = 0;
        let lastIndent = 0;
        let lineIndex = 0;
        let line = "";
      
        for await (line of rl) {
          const trimmedLine = line.trim();
          if (trimmedLine === '') {
            lineIndex++;
            continue; // por lineas vacías
          }
      
          const matchResult = line.match(/^(\s*)/);
            const currentLineIndent = matchResult ? matchResult[0].length : 0;
          
          if (currentLineIndent <= lastIndent && currentDepth > 0) {
            currentDepth--;
            lastIndent = currentLineIndent;
          }
      
          if (currentDepth < keyParts.length && trimmedLine.startsWith(keyParts[currentDepth])) {
            lastIndent = currentLineIndent;
            if (currentDepth === keyParts.length - 1) {
              // Encontramos la clave completa.
              return lineIndex;
            }
            currentDepth++;
          }
          lineIndex++;
        }
      
        return -1; // nunca debería pasar que no la encontramos
      }
}
