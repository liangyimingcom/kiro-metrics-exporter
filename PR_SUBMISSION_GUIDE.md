# PR 提交流程指南

本文档详细说明如何将你的改进提交到原始项目 [DiscreteTom/kiro-metrics-exporter](https://github.com/DiscreteTom/kiro-metrics-exporter)。

## 你的 GitHub 信息

- **GitHub 账号**: liangyimingcom
- **Fork 地址**: https://github.com/liangyimingcom/kiro-metrics-exporter

---

## 步骤一：克隆你的 Fork（已完成 Fork）

```bash
# 克隆你的 fork 到本地
git clone https://github.com/liangyimingcom/kiro-metrics-exporter.git

# 进入项目目录
cd kiro-metrics-exporter

# 添加原始仓库作为 upstream
git remote add upstream https://github.com/DiscreteTom/kiro-metrics-exporter.git

# 验证 remote 配置
git remote -v
# 应该显示:
# origin    https://github.com/liangyimingcom/kiro-metrics-exporter.git (fetch)
# origin    https://github.com/liangyimingcom/kiro-metrics-exporter.git (push)
# upstream  https://github.com/DiscreteTom/kiro-metrics-exporter.git (fetch)
# upstream  https://github.com/DiscreteTom/kiro-metrics-exporter.git (push)
```

---

## 步骤二：创建功能分支

```bash
# 确保你在 main 分支
git checkout main

# 从 upstream 获取最新代码
git fetch upstream
git merge upstream/main

# 创建新的功能分支
git checkout -b feature/enhanced-ui-and-logging

# 验证当前分支
git branch
# * feature/enhanced-ui-and-logging
#   main
```

---

## 步骤三：复制你的改进代码

将你当前项目的改进文件复制到克隆的仓库中：

```bash
# 假设你的改进代码在 ~/your-project/
# 克隆的仓库在 ~/kiro-metrics-exporter/

# 复制源代码文件
cp ~/your-project/src/extension.ts ~/kiro-metrics-exporter/src/
cp ~/your-project/src/metricsService.ts ~/kiro-metrics-exporter/src/
cp ~/your-project/src/metricsExporterProvider.ts ~/kiro-metrics-exporter/src/
cp ~/your-project/src/logger.ts ~/kiro-metrics-exporter/src/  # 新文件

# 复制配置文件
cp ~/your-project/package.json ~/kiro-metrics-exporter/

# 复制文档（可选）
cp ~/your-project/CHANGELOG.md ~/kiro-metrics-exporter/
```

**或者使用 rsync 批量复制：**
```bash
rsync -av --exclude='node_modules' --exclude='out' --exclude='.git' \
  ~/your-project/src/ ~/kiro-metrics-exporter/src/
```

---

## 步骤四：检查更改

```bash
# 查看所有更改的文件
git status

# 查看具体更改内容
git diff

# 查看新增文件
git status --porcelain | grep "^??"
```

---

## 步骤六：提交更改

```bash
# 添加所有更改
git add .

# 或者分别添加
git add src/extension.ts
git add src/metricsService.ts
git add src/metricsExporterProvider.ts
git add src/logger.ts
git add package.json
git add CHANGELOG.md

# 提交更改（使用有意义的提交信息）
git commit -m "feat: Enhanced UI with step-by-step workflow and operation logging

- Add dedicated Activity Bar icon for Metrics Exporter
- Reorganize configuration into 4 steps
- Add automatic User ID resolution from username
- Add Display Name resolution via DescribeUser API
- Add S3 permission check functionality
- Add Logger module for operation logging
- Add Open Log File/Folder/Settings commands
- Improve Settings page with ordering and clickable links
- Add version info display in TreeView

Closes #XX (if applicable)"
```

**提交信息格式说明：**
- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `refactor:` - 代码重构
- `style:` - 代码格式调整
- `test:` - 测试相关

---

## 步骤七：推送到你的 Fork

```bash
# 推送功能分支到你的 fork
git push origin feature/enhanced-ui-and-logging
```

---

## 步骤八：创建 Pull Request

1. 打开浏览器访问你的 Fork：`https://github.com/你的用户名/kiro-metrics-exporter`

2. 你会看到一个黄色提示框：
   > "feature/enhanced-ui-and-logging had recent pushes..."
   
   点击 **Compare & pull request** 按钮

3. 填写 PR 信息：

   **Title:**
   ```
   feat: Enhanced UI with step-by-step workflow, user resolution & operation logging
   ```

   **Description:**
   复制 `PULL_REQUEST.md` 的内容到描述框中

4. 检查以下设置：
   - Base repository: `DiscreteTom/kiro-metrics-exporter`
   - Base branch: `main`
   - Head repository: `你的用户名/kiro-metrics-exporter`
   - Compare branch: `feature/enhanced-ui-and-logging`

5. 点击 **Create pull request**

---

## 步骤九：等待审核

PR 创建后：

1. **自动检查**：等待 CI/CD 检查通过（如果有配置）
2. **代码审核**：维护者会审核你的代码
3. **反馈处理**：如果有修改建议，按以下步骤处理：

```bash
# 在本地修改代码
# ...修改文件...

# 提交修改
git add .
git commit -m "fix: Address review feedback"

# 推送更新
git push origin feature/enhanced-ui-and-logging
```

PR 会自动更新，无需创建新的 PR。

---

## 常见问题

### Q: 如何同步 upstream 的最新更改？

```bash
git fetch upstream
git checkout main
git merge upstream/main
git checkout feature/enhanced-ui-and-logging
git rebase main
```

### Q: 如何解决合并冲突？

```bash
# 如果 rebase 时出现冲突
# 1. 编辑冲突文件，解决冲突
# 2. 标记为已解决
git add <冲突文件>
# 3. 继续 rebase
git rebase --continue
```

### Q: 如何修改最后一次提交信息？

```bash
git commit --amend -m "新的提交信息"
git push --force origin feature/enhanced-ui-and-logging
```

### Q: 如何将多个提交合并为一个？

```bash
# 合并最近 N 个提交
git rebase -i HEAD~N
# 在编辑器中将除第一个外的 pick 改为 squash
# 保存并编辑合并后的提交信息
git push --force origin feature/enhanced-ui-and-logging
```

---

## 提交前检查清单

- [ ] 代码能正常编译 (`npm run compile`)
- [ ] 扩展能正常运行 (F5 测试)
- [ ] 所有新功能都已测试
- [ ] 提交信息清晰明了
- [ ] PR 描述完整详细
- [ ] 没有包含敏感信息（密钥、个人数据等）
- [ ] 没有包含不必要的文件（node_modules、.vsix 等）

---

## 文件清单

提交 PR 时应包含以下文件更改：

### 必须包含
- `src/extension.ts` - 扩展入口
- `src/metricsService.ts` - 核心服务
- `src/metricsExporterProvider.ts` - TreeView 提供者
- `src/logger.ts` - 新增日志模块
- `package.json` - 配置和命令定义

### 建议包含
- `CHANGELOG.md` - 版本更新记录
- `README.md` - 更新使用说明（如有需要）

### 不要包含
- `node_modules/` - 依赖目录
- `out/` - 编译输出
- `*.vsix` - 打包文件
- `.kiro/` - Kiro 配置目录
- 个人配置文件

---

## 联系方式

如果在提交过程中遇到问题：
1. 查看 GitHub 官方文档：https://docs.github.com/en/pull-requests
2. 在原始仓库创建 Issue 询问
3. 参考其他 PR 的格式和流程

祝你 PR 顺利！🎉
