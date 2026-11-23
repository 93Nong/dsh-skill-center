# Skill 中心 · dsh-skill-center

一个 DSH 插件：把**这台机器上所有 Agent 的 skill** 收进一张清单，并顺手把 **DSH 自己的插件** 也管起来。左侧栏一个入口，点开在右栏并排打开，对话照旧。

> 它不采集、不上传任何 skill / 插件的内容。所有状态只写在本机 `~/.dsh/skill-center/state.json`。

---

## 它解决什么问题

Skill 散落在十几个地方：DSH 自己的两个根、`~/.agents/skills` 共享库、Codex / Claude / Cursor / Gemini / OpenFilm / WorkBuddy / Qoder / Trae 各自的目录，还有你随手 clone 的一堆仓库。装得越多越记不清哪个是干嘛的、哪些必须一起用、哪些是同一份的副本。

插件这边也一样：DSH 的插件配置一半在插件自己的目录，一半在 profile 的 `cordis.patch.yml` 里，改个模型地址得来回翻文件。

Skill 中心就是那张**总表 + 总开关**。

## 核心功能

### 1. 一眼看清本机所有 skill
- 一次扫描 20+ 个候选根（DSH 用户目录、`~/.agents/skills` 共享库、项目内 `.dsh/skills`、`.agents/skills`、Codex、Claude、Cursor、Gemini、OpenCode、Trae CN、WorkBuddy、Qoder、OpenFilm 官方与自制目录、`~/.config/*/skills`……），存在才列，可自己再加目录。
- 只认标准形态：`<name>/SKILL.md` 目录包，或 `<name>.md` 平铺文件；自动读 frontmatter 的 `name` / `description`。
- 同一份 skill 装在几处时按真实路径 + 名字去重，并在详情里注明「同一份也装在：…」。

### 2. 每个 skill 都有一句人话说明
- 默认从 description 自动整理成一句中文；内置 24 个常用 skill 的中文说明。
- 想改就改（只存在本机 state 里，不动原文件），随时可「恢复自动」。

### 3. 自动归类 + 手动归类
- 先按「同一个应用 / 必须一起用」归组（`ace-studio-*`、`memory-*`、`office-*` 等，成员 ≥2 才成组），其余按类型（影像、音频、浏览器、办公、代码、设计、元能力、运维）。
- 类型对不上时，按来源应用自动建一个「<应用>（自动）」组。
- 手动归类永远优先；可新建分类、改名、删除（✕ 二次确认）。

### 4. 组合：只引用，不复制
- 把几个 skill 组成一个「组合」，组合里只存引用 —— 不改它们的归类、也不复制文件。
- 用时点「发送」，把 `/skill-a /skill-b ` 这样的斜杠命令直接写进对话输入框（不替你发出去）。

### 5. 托管：把 skill 收归 DSH 统一管理
- 一键把某个 skill 目录挪进 `~/.dsh/skills/<name>`，并在原位置留一个 Windows junction —— 原来那个应用照旧读得到，实际内容由 DSH 管。
- 随时「还回原位」，不留后遗症。

### 6. 插件也一样管
- 现读 `pluginManager.listBundles()`，默认只列你自己装的（可切「含 DSH 自带」）。
- 卡片 / 列表两种视图；一键启用 / 停用；看挂载条目（rows）与 overrides；打开插件目录；复制包名。
- **真的删除**：技能卡与插件卡右上角 ✕（两步确认）—— 技能删目录，插件卸载 bundle；随 DSH 安装的插件只能停用，托管来的链接不让删。

### 7. 插件配置就地改（含 profile 的 YAML）
- 自动发现插件目录 + 它的数据目录里的配置文件（如 modlens 的 `~/.modlens/config.json`、aurabot 的 `~/.dsh/plugins-data/aurabot/config.json`），`.json` 支持按字段结构化编辑。
- 大多数插件真正的配置在 profile 的 `cordis.patch.yml` 里 —— 也纳入：按子系统分组列出，写回时先备份成 `.bak-skill-center`，写完重新解析校验，不一致自动还原。
- 每组都标出**跟随 DSH 默认 / 本地 / 云端 · provider / 需要登录 / 未启用 / 还没填地址**，并给出模型目录与「打开所在文件夹」。
- API key 可以写进该插件自己的 `.env`（或 DSH 的 `~/.dsh/.env`），保存前备份；B 站 / 网易云 / 小黑盒这类是**登录态 Cookie**，不是 API key，页面会直接给「打开登录页」。
- 「其他设置」折叠区：开关、数字、短文本，字段名尽量中文化。

### 8. 能改名、能多选、能搜索
- 插件与 skill 都能起一个「在这个中心里显示的名字」，不动原始文件。
- 卡片左上角勾选，可多选后一起发送、或一次加进某个分类。

## 安装

### 从 DSH 插件市场
在「插件 → 发现」里搜 **Skill 中心**，点安装。（索引源见下）

### 从 GitHub
```bash
# 把包目录装进 profile（把 <本仓库路径> 换成本地克隆路径）
# 或在 DSH 里：插件 → 安装 → 选择本地目录
```
插件加载后，左侧栏 New Session 下方出现「Skill 中心」；点它在右栏打开页面。

### 手动
把本目录放进 `~/.dsh/profiles/<profile>/node_modules/` 同级并加一行依赖，或直接用 `plugin_manager.installBundle(绝对路径)`。

## 配置

`cordis.patch.yml` 只暴露一个字段：

```yaml
- insert:
    - id: skill-center
      name: "dsh-skill-center"
      config:
        roots: []   # 额外扫描根（页面里也可以随时加）
```

## 数据与隐私

| 位置 | 内容 |
| --- | --- |
| `~/.dsh/skill-center/state.json` | 手写的说明、归类、组合、改名、托管记录（约 1–2 KB） |
| `~/.dsh/skill-center/client.log` | 页面渲染出错时的诊断行（可随时删） |

- 不发任何网络请求（除了页面和 Host 之间的本机 HTTP）。
- 不注册任何 system prompt 片段、不注册工具、不开定时器 → **开着不用，0 token**。
- 删除、写配置、写 `.env` 都会先备份。

## 截图

> `docs/screenshots/` 待补：技能库（卡片网格）、插件详情（模型 / 地址 / 密钥分组）、组合页。

## 许可与致谢

- 代码：MIT（见 [LICENSE](LICENSE)）。
- 界面在 2026-11 做过一次视觉整理，方法参考 [unslop](https://github.com/damirsokolovsky/unslop)（Damir Sokolovsky，CC BY 4.0）。
- 图标全部为内联 SVG，无第三方素材；字体沿用 DSH 主题变量，不自带字体。
