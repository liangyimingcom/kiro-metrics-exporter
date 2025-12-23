import * as vscode from 'vscode';
import { MetricsService } from './metricsService';

export class MetricsExporterProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null | void> = new vscode.EventEmitter<ConfigItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private context: vscode.ExtensionContext,
        private metricsService: MetricsService
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConfigItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ConfigItem): Thenable<ConfigItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                new ConfigItem(
                    'AWS Configuration',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'aws-config'
                )
            ]);
        } else if (element.id === 'aws-config') {
            // AWS config children
            const config = vscode.workspace.getConfiguration('metricsExporter');
            const accessKey = config.get<string>('aws.accessKey', '');
            const secretKey = config.get<string>('aws.secretKey', '');
            
            return Promise.resolve([
                new ConfigItem(
                    `Access Key: ${accessKey ? '***' + accessKey.slice(-4) : 'Not set'}`,
                    vscode.TreeItemCollapsibleState.None,
                    'access-key',
                    {
                        command: 'metricsExporter.setAccessKey',
                        title: 'Set Access Key',
                        arguments: []
                    }
                ),
                new ConfigItem(
                    `Secret Key: ${secretKey ? '***' + secretKey.slice(-4) : 'Not set'}`,
                    vscode.TreeItemCollapsibleState.None,
                    'secret-key',
                    {
                        command: 'metricsExporter.setSecretKey',
                        title: 'Set Secret Key',
                        arguments: []
                    }
                )
            ]);
        }
        return Promise.resolve([]);
    }
}

export class ConfigItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly id: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.id = id;
        this.tooltip = this.label;
        this.contextValue = id;
        
        if (command) {
            this.command = command;
        }
    }
}