# Kiro Metrics Exporter

A VSCode extension that exports directory metrics to AWS S3.

## Features

- **Configuration Panel**: Left sidebar panel for AWS credentials management
- **Directory Scanning**: Scans workspace directories and extracts metrics
- **S3 Upload**: Uploads metrics data to AWS S3 (currently mock implementation)

## Setup

1. Install the extension
2. Open the "Metrics Exporter" panel in the Explorer sidebar
3. Configure your AWS credentials:
   - Click on "Access Key" to set your AWS Access Key
   - Click on "Secret Key" to set your AWS Secret Key
4. Click the cloud upload button to export metrics

## Current Implementation

This is a basic implementation with:
- ✅ VSCode extension structure
- ✅ Left sidebar configuration panel
- ✅ AWS credential input fields
- ✅ Mock directory scanning
- ✅ Mock S3 upload functionality

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

## Testing

1. Press `F5` to open a new Extension Development Host window
2. The extension will be loaded automatically
3. Look for "Metrics Exporter" in the Explorer sidebar
4. Test the configuration and export functionality

## Next Steps

- Implement actual S3 upload functionality
- Add configurable S3 bucket and region settings
- Enhance metrics collection with more detailed analysis
- Add error handling and validation
- Implement proper credential encryption