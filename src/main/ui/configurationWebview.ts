import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import HTML from '../utils/html';

// TODO: refactorizar esta clase con la de I18nInformation
export default class ConfigurationWebview {
    private static panel: vscode.WebviewPanel | undefined;
    private _context: vscode.ExtensionContext;
    private ymlContent: { [key: string]: any } = {};

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async showConfiguration() {
        if (ConfigurationWebview.panel) {
            ConfigurationWebview.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        ConfigurationWebview.panel = vscode.window.createWebviewPanel(
            'configuration',
            'I18n Settings',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        await this.refresh();

        ConfigurationWebview.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'addFiles':
                    await this.addFiles();
                    break;
                case 'removeFile':
                    await this.removeFiles(message.files);
                    break;
            }
            await this.refresh();
        });

        ConfigurationWebview.panel.onDidDispose(() => {
            ConfigurationWebview.panel = undefined;
        });
    }

    private async refresh() {
        const baseYmlFiles = this.getBaseYmlFiles();
        this.ymlContent = await this.getListYmlContent(baseYmlFiles);
        if (ConfigurationWebview.panel) {
            ConfigurationWebview.panel.webview.html = await this.getWebviewContent();
        }
    }

    private getBaseYmlFiles(): string[] {
        const configuration = vscode.workspace.getConfiguration('i18nExtractor');
        const baseYmlFiles: string[] = configuration.get('baseYmlFiles', []);
        return baseYmlFiles;
    }

    private async readYamlFile(filePath: string): Promise<any> {
        try {
            const uri = vscode.Uri.file(filePath);
            const fileContent = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
            return yaml.load(fileContent);
        } catch (error) {
            console.error(`Error reading YAML file: ${filePath}`, error);
            throw error;
        }
    }

    private async getListYmlContent(baseYmlFiles: string[]): Promise<{ [key: string]: any }> {
        let allEntries: { [key: string]: any } = {};

        for (const filePath of baseYmlFiles) {
            const yamlContent = await this.readYamlFile(filePath);
            this.flattenAndStoreYamlContent('', yamlContent, allEntries);
        }

        return allEntries;
    }

    private flattenAndStoreYamlContent(prefix: string, content: any, allEntries: { [key: string]: any }) {
        if (typeof content === 'object' && content !== null && !(content instanceof Array)) {
            for (const [key, value] of Object.entries(content)) {
                const newPrefix = prefix ? `${prefix}.${key}` : key;
                this.flattenAndStoreYamlContent(newPrefix, value, allEntries);
            }
        } else {
            allEntries[prefix] = content;
        }
    }

    private async addFiles() {
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Add',
            filters: { 'YAML Files': ['yml'] },
        });

        if (files) {
            const configuration = vscode.workspace.getConfiguration('i18nExtractor');
            let baseYmlFiles: string[] = configuration.get('baseYmlFiles', []);

            files.forEach((file) => {
                const filePath = file.fsPath;
                if (!baseYmlFiles.includes(filePath)) {
                    baseYmlFiles.push(filePath);
                }
            });

            await configuration.update('baseYmlFiles', baseYmlFiles, vscode.ConfigurationTarget.Global);
        }
    }

    private async removeFiles(filesToRemove: string[]) {
        const configuration = vscode.workspace.getConfiguration('i18nExtractor');
        let baseYmlFiles: string[] = configuration.get('baseYmlFiles', []);
        baseYmlFiles = baseYmlFiles.filter((file) => !filesToRemove.includes(file));
        await configuration.update('baseYmlFiles', baseYmlFiles, vscode.ConfigurationTarget.Global);
    }

    private async getWebviewContent(): Promise<string> {
        const fileListItems = this.getBaseYmlFiles().map((file) => `<li>${file}</li>`).join('');
        const ymlContentRows = Object.entries(this.ymlContent || {}).map(([key, value]) => {
            return `<vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">${key}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${HTML.escape(value)}</vscode-data-grid-cell>
            </vscode-data-grid-row>`;
        }).join('');

        const toolkitUri = ConfigurationWebview.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'toolkit.js'));
        const codiconsUri = ConfigurationWebview.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'codicon.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${codiconsUri}" rel="stylesheet">
                <script type="module" src="${toolkitUri}"></script>
                <style>
                    body, html {
                        height: 100%;
                        margin: 0;
                    }
                    #content {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                    }
                    #fileListContainer, vscode-button {
                        flex-shrink: 0;
                    }
                    #buttonsContainer {
                        display: flex;
                        gap: 15px;
                        padding-top: 15px;
                    }
                    
                    #dataGridContainer {
                        flex-grow: 1;
                        overflow-y: auto;
                    }
                    #fileListContainer {
                        background-color: var(--vscode-input-background);
                        overflow-y: auto;
                        height: 300px;
                        box-sizing: border-box;
                        margin-top: 15px;
                    }
                    ul#fileList {
                        list-style: none;
                        margin: 0;
                        padding: 0;
                    }
                    ul#fileList li {
                        padding: 5px;
                        cursor: pointer;
                    }
                    ul#fileList li:hover, ul#fileList li.selected {
                        background-color: var(--vscode-inputOption-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div id="content">
                    <div id="buttonsContainer">
                        <vscode-button appearance="primary" id="addFilesButton">Add Files</vscode-button>
                        <vscode-button appearance="secondary" id="removeSelectedButton" disabled>Remove Selected</vscode-button>
                    </div>
                    <div id="fileListContainer">
                        <ul id="fileList">${fileListItems}</ul>
                    </div>
                    <div id="dataGridContainer">
                        <vscode-data-grid generate-header="sticky">
                            <vscode-data-grid-row row-type="sticky-header">
                                <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Key</vscode-data-grid-cell>
                                <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Value</vscode-data-grid-cell>
                            </vscode-data-grid-row>
                            ${ymlContentRows}
                        </vscode-data-grid>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('addFilesButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'addFiles' });
                    });
                    
                    const fileList = document.getElementById('fileList');
                    fileList.addEventListener('click', (event) => {
                        if (event.target.tagName === 'LI') {
                            event.target.classList.toggle('selected');
                            const anySelected = fileList.querySelector('.selected');
                            document.getElementById('removeSelectedButton').disabled = !anySelected;
                        }
                    });
                    
                    document.getElementById('removeSelectedButton').addEventListener('click', () => {
                        const selectedItems = fileList.querySelectorAll('.selected');
                        const filesToRemove = Array.from(selectedItems).map((item) => item.textContent);
                        vscode.postMessage({
                            command: 'removeFile',
                            files: filesToRemove
                        });
                        
                        document.getElementById('removeSelectedButton').disabled = true;
                    });
                </script>
            </body>
            </html>`;
    }
}
