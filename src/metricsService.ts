import * as vscode from 'vscode';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

export class MetricsService {
    private s3Client: S3Client | null = null;

    constructor() {
        this.registerCommands();
    }

    private registerCommands() {
        // Register commands for setting AWS credentials
        vscode.commands.registerCommand('metricsExporter.setAccessKey', async () => {
            const accessKey = await vscode.window.showInputBox({
                prompt: 'Enter AWS Access Key',
                password: true,
                placeHolder: 'AKIA...'
            });
            
            if (accessKey) {
                await vscode.workspace.getConfiguration().update('metricsExporter.aws.accessKey', accessKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('AWS Access Key saved');
                this.refreshTreeView();
            }
        });

        vscode.commands.registerCommand('metricsExporter.setSecretKey', async () => {
            const secretKey = await vscode.window.showInputBox({
                prompt: 'Enter AWS Secret Key',
                password: true,
                placeHolder: 'Your secret key...'
            });
            
            if (secretKey) {
                await vscode.workspace.getConfiguration().update('metricsExporter.aws.secretKey', secretKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('AWS Secret Key saved');
                this.refreshTreeView();
            }
        });
    }

    private refreshTreeView() {
        vscode.commands.executeCommand('metricsExporter.refresh');
    }

    private initializeS3(): boolean {
        const config = vscode.workspace.getConfiguration('metricsExporter');
        const accessKey = config.get<string>('aws.accessKey');
        const secretKey = config.get<string>('aws.secretKey');

        if (!accessKey || !secretKey) {
            vscode.window.showErrorMessage('AWS credentials not configured. Please set Access Key and Secret Key.');
            return false;
        }

        this.s3Client = new S3Client({
            region: 'us-east-1', // Default region, can be made configurable
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey
            }
        });

        return true;
    }

    async exportMetrics() {
        vscode.window.showInformationMessage('Starting metrics export...');

        if (!this.initializeS3()) {
            return;
        }

        try {
            // Mock: Scan local directory for metrics
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const metrics = await this.scanDirectoryForMetrics(workspaceFolder.uri.fsPath);
            
            // Mock: Upload to S3
            await this.uploadMetricsToS3(metrics);
            
            vscode.window.showInformationMessage('Metrics exported successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Export failed: ${error}`);
        }
    }

    private async scanDirectoryForMetrics(dirPath: string): Promise<any> {
        // Mock implementation - in real scenario, this would scan files and extract actual metrics
        const mockMetrics = {
            timestamp: new Date().toISOString(),
            directory: dirPath,
            fileCount: await this.countFiles(dirPath),
            totalSize: await this.calculateDirectorySize(dirPath),
            fileTypes: await this.getFileTypeDistribution(dirPath),
            lastModified: new Date().toISOString()
        };

        vscode.window.showInformationMessage(`Scanned directory: ${dirPath}`);
        return mockMetrics;
    }

    private async countFiles(dirPath: string): Promise<number> {
        // Mock file counting
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            let count = 0;
            
            for (const file of files) {
                if (file.isFile()) {
                    count++;
                } else if (file.isDirectory() && !file.name.startsWith('.')) {
                    count += await this.countFiles(path.join(dirPath, file.name));
                }
            }
            
            return count;
        } catch {
            return 0;
        }
    }

    private async calculateDirectorySize(dirPath: string): Promise<number> {
        // Mock size calculation
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            let size = 0;
            
            for (const file of files) {
                const filePath = path.join(dirPath, file.name);
                if (file.isFile()) {
                    const stats = fs.statSync(filePath);
                    size += stats.size;
                } else if (file.isDirectory() && !file.name.startsWith('.')) {
                    size += await this.calculateDirectorySize(filePath);
                }
            }
            
            return size;
        } catch {
            return 0;
        }
    }

    private async getFileTypeDistribution(dirPath: string): Promise<Record<string, number>> {
        // Mock file type distribution
        const distribution: Record<string, number> = {};
        
        try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const file of files) {
                if (file.isFile()) {
                    const ext = path.extname(file.name) || 'no-extension';
                    distribution[ext] = (distribution[ext] || 0) + 1;
                } else if (file.isDirectory() && !file.name.startsWith('.')) {
                    const subDistribution = await this.getFileTypeDistribution(path.join(dirPath, file.name));
                    for (const [ext, count] of Object.entries(subDistribution)) {
                        distribution[ext] = (distribution[ext] || 0) + count;
                    }
                }
            }
        } catch {
            // Ignore errors
        }
        
        return distribution;
    }

    private async uploadMetricsToS3(metrics: any): Promise<void> {
        if (!this.s3Client) {
            throw new Error('S3 client not initialized');
        }

        // Mock S3 upload - in real scenario, this would actually upload to S3
        const bucketName = 'kiro-metrics-bucket'; // This should be configurable
        const key = `metrics/${Date.now()}-metrics.json`;
        
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock successful upload
        vscode.window.showInformationMessage(`Mock upload to S3: s3://${bucketName}/${key}`);
        console.log('Mock metrics data:', JSON.stringify(metrics, null, 2));

        // Uncomment below for actual S3 upload:
        /*
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: JSON.stringify(metrics, null, 2),
            ContentType: 'application/json'
        });

        try {
            await this.s3Client.send(command);
            vscode.window.showInformationMessage(`Successfully uploaded to S3: s3://${bucketName}/${key}`);
        } catch (error) {
            throw new Error(`S3 upload failed: ${error}`);
        }
        */
    }
}