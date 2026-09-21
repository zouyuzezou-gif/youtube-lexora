# YouTube Lexora

Learn English from YouTube with bilingual transcripts and contextual AI explanations.

在自己已登录的 YouTube 页面中学习英语。适合英语播客、AI 访谈与学术视频。

## 功能

- 在 Chrome 侧栏阅读英文与中文对照字幕。
- 获取字幕后暂停视频，提前翻译整段内容；超长字幕自动合并成可读段落，并使用五路批量请求加速。完成后自行播放，字幕随进度跨页高亮。
- 显示翻译进度，支持停止与继续；已完成批次存入本机缓存。网络、限流或 AI 服务短暂波动时会自动等待并重试，无需反复点击“继续”。
- 侧栏与后台版本不一致时自动协商批量大小；旧后台只接受 10 条时自动降级重试。
- 搜索完整字幕，点击时间点回放，解释短语与概念。
- 生成中文概览与章节要点，保存和搜索学习笔记。
- 将视频全部中英对话导出为可打印学习资料；DeepSeek 会整理对应的重点语句与地道词组。导出页支持直接打印、另存为 PDF 和保存独立 HTML 文件，AI 整理结果会缓存。

## 安装

1. 在本仓库点击 **Code → Download ZIP**，解压下载文件。
2. 在普通 Chrome 窗口打开 `chrome://extensions`，开启开发者模式。
3. 点击“加载已解压的扩展程序”，选择解压后的 **extension** 文件夹（里面有 `manifest.json`）。
4. 刷新已经打开的 YouTube 页面，点击 Chrome 工具栏的扩展图标，选择 **YouTube Lexora**。
5. 在侧栏“设置”分别填入自己的 DeepSeek 与 Supadata API 密钥并保存，然后测试 DeepSeek。
6. 打开普通 YouTube 视频，点击“获取当前视频完整字幕”。准备完成后播放视频。
7. 打开“导出”标签，点击“AI 整理并打开导出页”，即可打印或保存完整语料。

更新本地代码后，需要在扩展管理页点击扩展的刷新按钮，并刷新 YouTube 页面。

## 服务与费用

使用 [Supadata](https://supadata.ai/) 的原生字幕接口获取字幕，使用 [DeepSeek](https://platform.deepseek.com/) 的 `deepseek-flash` 进行翻译、解释与概览。两个服务分别计费，使用者自行提供密钥。提前翻译会处理整段视频，包括尚未观看的部分。

## 隐私

Google 登录由 YouTube 和 Chrome 处理。扩展不要求 Google 密码，也不导入账号 Cookie。

视频链接发送给 Supadata；标题、相关字幕与解释问题发送给 DeepSeek。密钥、译文和笔记存于当前 Chrome 配置的扩展本地存储中，不是 Windows 系统加密存储。不要将密钥、扩展存储导出文件或个人学习记录提交到仓库。

## 当前限制

这是开发者模式安装的早期版本，尚未上架 Chrome Web Store。主要面向普通 `/watch?v=` 视频；没有原生字幕的视频不自动转写。字幕缓存保留最近 12 个视频，笔记最多 500 条。准备翻译期间请保持侧栏打开；停止时最多五个已发送批次可能仍会完成并计费。

需要普通 Chrome 窗口支持侧栏；YouTube 独立应用窗口尚未验证。当前测试覆盖字幕解析、批量翻译调度、缓存跳过和停止行为，未覆盖所有浏览器场景。

## 开发与测试

使用 Node.js 运行：

```sh
npm test
```

无构建依赖，直接加载 `extension` 文件夹即可。

## 致谢

学习流程参考 [Zara Zhang 的 YouTube Digest](https://github.com/zarazhangrui/youtube-digest)。YouTube Lexora 是独立项目，与 YouTube、Google、DeepSeek 或 Supadata 无隶属关系。
