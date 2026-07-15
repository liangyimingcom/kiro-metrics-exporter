# Kiro Metrics Exporter

[![Open VSX Version](https://img.shields.io/open-vsx/v/DiscreteTom/kiro-metrics-exporter)](https://open-vsx.org/extension/DiscreteTom/kiro-metrics-exporter)

A VSCode extension that exports locally reconstructed Kiro IDE usage metrics to AWS S3.

## Kiro 1.0 metrics

Kiro 1.0 introduced two relevant changes:

1. **Official enterprise reporting:** The legacy `by_user_analytic` report covers CLI and plugin usage, not the Kiro IDE metrics exported by this extension. Newer per-client reports may expose high-level `KIRO_IDE` activity such as conversations, credits, and messages, but they do not provide `Chat_AICodeLines` and may not be available in every environment. See the [official per-user activity documentation](https://kiro.dev/docs/cli/enterprise/monitor-and-track/user-activity/).
2. **Local session persistence:** The IDE now stores ACP session events in `~/.kiro/sessions/**/messages.jsonl`. This extension parses successful `create`, `write`, `append`, `replace`, `fs_write`, `fs_append`, and `str_replace` tool calls from those JSONL files to estimate `Chat_AICodeLines`. On upgraded installations it also discovers pre-1.0 execution logs across the historical workspace/storage-key layout under `globalStorage/kiro.kiroagent`, without depending on one fixed internal storage key. Overlapping execution IDs prefer Kiro 1.0 data, with a legacy fallback only when the modern record has no code operations.

The local calculation is a compatibility estimate, not a replacement for Kiro's official telemetry. In particular, local session files do not provide authoritative credit, overage, inline-completion, or acceptance metrics. A `replace_all` call is conservatively counted as one replacement because the persisted event does not expose the historical match count.

## Setup

### Step 1: AWS Credentials

1. Click the **📊 Metrics Exporter** icon in the Activity Bar (left sidebar)
2. Expand **Step 1: AWS Credentials**
3. Configure:
   - **Access Key**: Your AWS Access Key ID
   - **Secret Key**: Your AWS Secret Access Key
   - **Identity Store ID**: Your AWS Identity Store ID (e.g., `d-1234567890`)
   - **Identity Store Region**: Region for Identity Store (default: `us-east-1`)

### Step 2: User Identity

1. Expand **Step 2: User Identity**
2. Click **Username** and enter your username
3. Click **🔄 Resolve User ID & Display Name**
4. User ID and Display Name will be auto-populated

### Step 3: S3 Configuration

1. Expand **Step 3: S3 Configuration**
2. Configure:
   - **S3 Prefix**: Full S3 path (e.g., `s3://bucket/prefix/AWSLogs/accountId/KiroLogs/by_user_analytic/Region/`)
   - **S3 Region**: Region for S3 operations (default: `us-east-1`)
3. Click **🔍 Check S3 Write Permission** to verify access

### Step 4: Logs & Settings

- **📄 Open Log File**: View today's operation log
- **📂 Open Log Folder**: Open logs directory
- **⚙️ Open Settings**: Quick access to extension settings

## Usage

### Export Metrics

Use the buttons in the panel header:

| Button                       | Description                         |
| ---------------------------- | ----------------------------------- |
| ⏱️ Upload Last 7 Days        | Export metrics for T-7 to T-1       |
| 📤 Upload All Till Yesterday | Export all available data up to T-1 |

### CSV Output Format

| Column            | Description                    |
| ----------------- | ------------------------------ |
| UserId            | AWS Identity Center User ID    |
| Date              | Date in MM-DD-YYYY format      |
| Chat_AICodeLines  | Net lines of AI-generated code |
| Chat_MessagesSent | Number of executions           |
| Other columns     | Set to 0 for compatibility     |

### S3 Path Structure

```
{s3Prefix}/{year}/{month}/{day}/00/kiro-ide-{userId}.csv
```

Example:

```
s3://bucket/prefix/AWSLogs/123456789012/KiroLogs/by_user_analytic/us-east-1/2025/01/04/00/kiro-ide-abc123.csv
```

**Note**: Uploads are idempotent - same path for same date/user combination.

## Operation Logs

Logs are saved to: `~/.kiro-metrics-exporter/logs/metrics-exporter-YYYY-MM-DD.log`

Log contents include:

- Operation start/end timestamps
- User and S3 configuration
- Scan progress and results
- Upload progress (N/M files)
- Timing statistics

Example log:

```
[2025-01-04T10:30:00.000Z] [INFO] [Upload Last 7 Days] ========== Operation Started ==========
[2025-01-04T10:30:00.001Z] [INFO] [Upload Last 7 Days] User: john.doe, UserId: xxx-xxx
[2025-01-04T10:30:01.000Z] [INFO] [Upload Last 7 Days] [Scanning] Completed in 1.00s - Found 50 records
[2025-01-04T10:30:02.000Z] [INFO] [Upload Last 7 Days] [Upload] 1/7 - 2025-01-03 -> s3://bucket/path/file.csv
```

## Requirements

### AWS Permissions

| Service        | Permission     | Purpose                                |
| -------------- | -------------- | -------------------------------------- |
| S3             | `PutObject`    | Upload CSV files                       |
| S3             | `DeleteObject` | Clean up test files (permission check) |
| Identity Store | `GetUserId`    | Resolve username to User ID            |
| Identity Store | `DescribeUser` | Get Display Name                       |

### Kiro Agent Data Location

| Kiro version | Platform | Path                                                                   |
| ------------ | -------- | ---------------------------------------------------------------------- |
| 1.0+         | All      | `~/.kiro/sessions`                                                     |
| Legacy source | Windows  | `%APPDATA%\Kiro\User\globalStorage\kiro.kiroagent`                   |
| Legacy source | macOS    | `~/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent` |
| Legacy source | Linux    | `~/.config/Kiro/User/globalStorage/kiro.kiroagent`                     |

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

1. Press `F5` to open Extension Development Host
2. Click the **📊 Metrics Exporter** icon in Activity Bar
3. Configure AWS settings following the 4 steps
4. Test upload functionality

## Troubleshooting

### Common Issues

| Issue                                  | Solution                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| User resolution fails                  | Check Identity Store ID and credentials                                                          |
| S3 permission denied                   | Verify IAM policy has PutObject permission                                                       |
| No data found                          | On Kiro 1.0+, verify `~/.kiro/sessions` contains session folders with `messages.jsonl`; older versions use the legacy globalStorage path |
| Upload fails                           | Check S3 prefix format (must start with `s3://`)                                                 |
| Stats drop to zero after May 2026      | Use a build with Kiro 1.0 ACP JSONL support; older releases only understand legacy globalStorage logs |

### View Logs

1. Click **📄 Open Log File** in Step 4
2. Or navigate to `~/.kiro-metrics-exporter/logs/`

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
