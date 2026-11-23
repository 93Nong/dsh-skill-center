/**
 * Skill 中心（Host 半）。
 *
 * 干三件事，都不碰会话：
 *  1. 扫：把本机各处安装的 skill（`<name>/SKILL.md` 目录包，或 `<name>.md` 平铺文件）
 *     收成一张清单 —— DSH 自己的两个根、agents 共享库、Codex / Claude / Cursor /
 *     Gemini / OpenFilm 等应用的技能目录，以及用户自己加的任意目录。
 *  2. 整理：按"同一个应用 / 必须一起用"和"类型"自动归类，允许手动改；每个 skill 的
 *     "它是干什么的"默认由 frontmatter 的 description 自动整理，也可以自己改。
 *  3. 组合与托管：组合只存 skill 的引用（不改归类、不复制文件）；托管把一个 skill 挪进
 *     `$DSH_HOME/skills`，并在原位置留一个 Windows junction，原来那个应用照旧能读到，
 *     实际内容已经统一由 DSH 管。
 *
 * 状态只写在 `$DSH_HOME/skill-center/state.json`，扫描结果每次现算，不落盘缓存。
 * 浏览器半（client.js）通过两条 exact Fetch 路由读：/api/skill-center/state、/action。
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'skill-center'
export const inject = ['connection', 'pluginManager']

const NS = 'skill-center'
/** 本插件的包名：从自己的 package.json 读，发布改名后不用改代码。 */
const SELF = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')).name || 'skill-center'
  } catch {
    return 'skill-center'
  }
})()
/** Category key for "explicitly put nowhere". */
const NONE = '__none__'
const IS_WIN = process.platform === 'win32'
const MAX_EXCERPT = 1200
const CJS_REQUIRE = createRequire(import.meta.url)

/**
 * 中文说明表：键是 skill 的目录名（frontmatter 的 name）。
 *
 * skill 自己的 description 大多是英文的（Codex / agents 生态的习惯），页面上直接读
 * 不好用，所以这里按名字给一条中文的"它是干什么的"。查不到的才回退到 description
 * 的第一句；用户手写过的永远优先于这两者。
 */
const ZH_SUMMARY = {
  'ace-studio-audio-plugins': '在 ACE Studio 里操作音源与效果器：第三方 VST3/AU 乐器、效果器，以及 Studio 自带效果器。要加载、调参数、存预设，或某个开关只存在于插件界面里时用。',
  'ace-studio-features': 'ACE Studio 有哪些功能、什么时候用哪个：轨道类型与发声方式、音频效果、Vocal Synth 与声音库、AI 乐器、第三方乐器插件、生成式工具（Inspire Me / Music Enhancer / Add A Layer）和实用工具（Stem Splitter、Voice Changer、Vocal to MIDI、Doubles、标记轨、文件导入）。',
  'ace-studio-setup': '当 acestudio-cli 或 ACE Studio MCP 还没装好时，怎么把助手连上 ACE Studio。',
  'ace-studio-workflows': 'ACE Studio 的端到端流程：先做什么后做什么、每步该用哪个功能、哪些活必须拿到 Studio 外面做。跨多步的任务或"写一首歌"时用。',
  'audio-subtitle-roughcut': '原音做人声处理并 1.1 倍速后，用千问 Audio 3.1 出词级字幕，配合逐字稿纠错、语义分段和口误粗剪，最后 +8dB 交付可手调的审片台和同步 WAV/SRT；也能续做已有音频与字幕。',
  'autoglm-browser-agent': '智能浏览器自动化代理，能执行任何需要浏览器的任务：开网页、搜索、逛社交平台、点赞评论、登录、填表、截图、采集内容、比价、看新闻、操作在线文档。',
  'body-text-motion-effects': '正文文字动效库：FredTalk Deck 的正文模块，以及 Remotion 里文字滚动、遮罩刷出、逐字输出、淡入淡出、换词、数字跳动的参考入口。',
  'cangjie-skill': '把一本书、长视频逐字稿、播客、课程或访谈蒸馏成一套能直接执行的 skill。用户说"拆书""蒸馏一本书""把视频做成 skill"时用。',
  'code-brand-film': '纯代码做 10–60 秒（常见 15 秒）的品牌片或产品宣传片：一张静态 HTML 页面加一条暂停的 GSAP 时间轴，由渲染器逐帧取景，配一段 Python 合成的配乐。',
  'docx-format-preserving-edit': '对本地 .docx 做"保格式"的正文编辑（增删段落、批量改词）而不破坏排版；也处理 Windows 上文件被预览器占用、改名失败但能删除的情况。',
  'dsh-dafeiyu-deploy': '给已装 DSH 的机器按需部署、补齐或修复大肥鱼桌宠、Aurabot QQ（NapCatQQ / OneBot v11）、TTS、RVC/Breeze 统一翻唱、原曲匹配、歌曲来源（B 站 / 抖音）。只补缺项，不装 DSH 本体。',
  'ego-browser': '需要浏览器时默认先读这个 skill：开网页、操作网站、填表、点按钮、截图、抓页面数据、登录，以及网页应用的测试、走查、QA 与体验评审。',
  'fangcun': '做方寸 FANGCUN 互动 HTML 演示稿：提炼首页文案，用最多五项确认选 Logo、既有风格、动态背景和粒子文字开场，复用固定舞台与离线制作经验。适合网页演示、培训和实验，不做普通网站或 PPTX。',
  'fred-remotion-output': 'Fred 的视频制作日常入口：从成品音频、逐字稿、字幕和素材匹配到组件，出逐段前端建议、真实关键帧、完整 Remotion 视频与局部返修，含正文文字动效与按需技术参考。',
  'kuaicha-search': '企业数据查询、筛选与关系分析：查工商信息、股东股权、对外投资、实控人、司法与经营风险、知识产权、招投标、上市与舆情，或按地区 / 行业 / 成立时间 / 产业链筛选企业。',
  'mep-bridge': 'MEP 通用桥的助手手册：通过 MEP 工作台读本机应用状态、批量投递编辑操作、拿回执，或给新应用接一个 MEP driver。覆盖 ACE Studio、股哨、OpenTake、VoiceStudio、OpenFilm 等工作区。',
  'mv-director': '把一首歌做成真正的音乐 MV：画面全用代码画（canvas 逐帧、1080p 60 帧、不生图）。先听懂歌（拍子、小节、副歌、抽鼓、逐字对齐），再读懂歌词逐句分镜，让画面演出每句话并卡准音乐。',
  'openfilm': '用 OpenFilm 把视频做成一页网页：要视频、动效、动画、发布会开场片、讲解片、MV，或要剪辑、检查、渲染 film.html 时用。',
  'remotion-best-practices': '用 React 做视频（Remotion）的最佳实践与常见写法约定。',
  'tencent-docs-md-sync': '把本地 Markdown 传到腾讯文档并校验保真度、追加章节、给正文打高亮 / 删除线做审阅痕迹、给待办分色加序号，或把在线正文抓回来与本地稿逐条对账。',
  'unslop': '把一眼看出是 AI 写的界面改成有自己性格的设计：从产品本身找方向，按顺序修间距、配色、图标、文案、字号、布局、细节、视觉和动效。',
  'video-downloader': '下载或打开视频，用豆包或 LongCat-2.5 还原平台字幕、音频转录、关键帧、画面文字与剪辑观察，整理成 multimodal_transcript.md 素材底稿。',
  'xlsx': 'Excel 全流程：带公式和格式建表、做图表与透视表、读数据并清洗、批量改单元格。',
  'zy-cinematic-realism': '把剧本、短篇或梗概发展成场景理解、导演向美术概念和有动机的叙事关键帧；也能把场景想法、视觉参考整理成模型原生的图像提示词。',
}

/** 插件的中文说明（键 = bundle 包名）。插件自带的 description 常是英文，这里给中文；用户可以在界面里改成自己的。 */
const PLUGIN_ZH = {
  '@deepseek-ai/dsh-base': 'DSH 的核心本体（第一批补丁层）：会话、模型、工具、沙箱、技能、上下文压缩这些基础能力都在这里。不要停用。',
  '@deepseek-ai/dsh-web-app': 'DSH 的网页外壳：左侧栏、对话界面、右栏、主题这些前端都在这里。不要停用。',
  'billion-context': '上下文压缩：把长对话压成摘要，小窗口也够用，token 更省，一个会话能聊很久。',
  '@local/fast-download': '下载工具：优先多连接下载（Mister Download Manager），失败退 aria2，大文件转后台继续下。',
  '@zilliz/memsearch-dsh': '长期记忆（MemSearch）：把跨会话的要点存成 markdown，需要时按需回忆，还能评审「值得做成 skill」的候选。',
  'dsh-context': '上下文面板：看这次对话的上下文是怎么组成的、怎么变化的，并提供上下文相关命令。',
  '@deepseek-ai/dsh-experimental-cot-translation-bundle': '实验功能：把模型的推理过程机器翻译成中文显示。',
  'dshmarket': '可视化插件市场：在里面逛、搜、一键安装社区插件。',
  '@liustack/modlens': '给纯文本模型加上「看图」能力：通过本机已登录的 Antigravity CLI 读截图和图片，返回文字描述。',
  'dsh-aurabot-qq': 'Aurabot 大肥鱼：住在 QQ 里的 AI 伙伴，经 SnowLuma / OneBot v11 接入，附带几个 agent 预设。',
  [SELF]: '本插件（Skill 中心）：浏览、归类、组合本机所有 Agent 的 skill 并统一托管到 DSH，同时管理 DSH 插件的开关与配置。',
  '@local/mep-bridge': 'MEP 通用桥：读本机应用状态、批量投递编辑操作、拿回执，给 ACE Studio 等应用做驱动。',
  '@xmanrui/dsh-im': '把微信、飞书、企微、钉钉、QQ、Telegram、WhatsApp、Slack、Discord、Matrix 接到 DSH 上。',
  'dsh-better-sidebar': '增强右栏：文件树、编辑器、改动、任务、侧边对话都在一列里，每个会话独立；还对外提供注册侧栏页签的服务。',
  'dsh-connect-workbuddy': '把本机登录的 WorkBuddy 账号里的模型接进 DSH，按上游目录读每个模型的积分倍率，支持多账号与每日签到。',
  'dsh-purge': '破甲插件：让模型按要求放开限制，可以按模型换不同提示词。',
  'dsh-superagent': '给一个 GitHub 仓库配一个主动型 agent：听 GitHub / 飞书事件，按策略判断，把允许的请求变成工单并各自开一个会话执行。',
  '@deepseek-ai/dsh-acp-app': 'ACP 自动化外壳：只跑 JSON-RPC stdio，不带界面。',
  '@deepseek-ai/dsh-experimental-inspector-profile': '实验性检查工具：看原始会话日志、检查对话节点与统计。',
  '@deepseek-ai/dsh-headless': '无界面的一次性运行外壳：直接跑核心 Agent / Session，没有 Host、HTTP 和浏览器层。',
  '@deepseek-ai/dsh-sdk-app': 'SDK 外壳：用 stdio JSON-RPC 对外提供服务。',
  '@deepseek-ai/dsh-sdk-minimal': '最小 SDK 外壳：JSON-RPC、一个 DeepSeek 适配器、持久 shell 和 JSONL 会话。',
  '@deepseek-ai/dsh-experimental-voice-input-bundle': '实验功能：本地 SenseVoice 语音输入，首次使用会下载运行时。',
  '@deepseek-ai/dsh-experimental-auto-review': '实验功能：给每个工具调用加一层 LLM 授权审查（用于 Auto 权限预设）。',
  '@deepseek-ai/dsh-experimental-badge-skill-bundle': '给文档、PR 等产物加上「powered by dsh」徽标的技能。',
}

/* ------------------------------------------------------------------ 位置与状态 */

function homeDir() {
  return os.homedir()
}

function dshHome() {
  return process.env.DSH_HOME || path.join(homeDir(), '.dsh')
}

function agentsHome() {
  return process.env.DSH_AGENTS_HOME || path.join(homeDir(), '.agents')
}

/** Where adopted skills live; rank 400 in the Host's own skill scanner. */
function dshSkillRoot() {
  return path.join(dshHome(), 'skills')
}

function stateDir() {
  return path.join(dshHome(), NS)
}

function stateFile() {
  return path.join(stateDir(), 'state.json')
}

function emptyState() {
  return { version: 1, summaries: {}, pluginSummaries: {}, names: {}, pluginNames: {}, assignments: {}, categories: [], combos: [], roots: [], adopted: {} }
}

function loadState() {
  let raw = null
  try {
    raw = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
  } catch {
    raw = null
  }
  const st = Object.assign(emptyState(), raw && typeof raw === 'object' ? raw : {})
  for (const key of ['summaries', 'pluginSummaries', 'names', 'pluginNames', 'assignments', 'adopted']) {
    if (!st[key] || typeof st[key] !== 'object' || Array.isArray(st[key])) st[key] = {}
  }
  for (const key of ['categories', 'combos', 'roots']) {
    if (!Array.isArray(st[key])) st[key] = []
  }
  return st
}

function saveState(st) {
  fs.mkdirSync(stateDir(), { recursive: true })
  const tmp = stateFile() + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(st, null, 2), 'utf8')
  fs.renameSync(tmp, stateFile())
}

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

/* ---------------------------------------------------------------------- 文件 */

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function realish(p) {
  try {
    return fs.realpathSync.native(p)
  } catch {
    try {
      return fs.realpathSync(p)
    } catch {
      return p
    }
  }
}

function normKey(p) {
  const r = realish(path.resolve(p))
  return IS_WIN ? r.toLowerCase() : r
}

function hashId(p) {
  return createHash('sha1').update(normKey(p)).digest('hex').slice(0, 10)
}

function moveDir(from, to) {
  try {
    fs.renameSync(from, to)
    return
  } catch (error) {
    if (error && error.code !== 'EXDEV') throw error
  }
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true })
  fs.rmSync(from, { recursive: true, force: true })
}

/** Remove a link/junction only — never the directory behind it. */
function removeLink(p) {
  try {
    fs.unlinkSync(p)
    return true
  } catch {}
  try {
    fs.rmdirSync(p)
    return true
  } catch {
    return false
  }
}

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

/* --------------------------------------------------------------- frontmatter */

/** Tolerant YAML-lite reader: `key: value` pairs, quoted or bare, plus `|`/`>` blocks. */
function parseYamlLite(block) {
  const out = {}
  const lines = block.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || /^\s/.test(line)) continue
    const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    let value = kv[2].trim()
    if (/^[|>][+-]?$/.test(value)) {
      const folded = value.startsWith('>')
      const collected = []
      while (index + 1 < lines.length && (/^\s+/.test(lines[index + 1]) || lines[index + 1] === '')) {
        index += 1
        collected.push(lines[index].replace(/^[ \t]{1,8}/, ''))
      }
      while (collected.length > 0 && collected[collected.length - 1] === '') collected.pop()
      out[kv[1]] = folded ? collected.join(' ').replace(/\s+/g, ' ').trim() : collected.join('\n')
      continue
    }
    if (!value) continue
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const quote = value[0]
      value = value.slice(1, -1)
      value = quote === '"'
        ? value.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        : value.replace(/''/g, "'")
    }
    out[kv[1]] = value
  }
  return out
}

function parseSkillText(text) {
  const src = String(text || '').replace(/^\uFEFF/, '')
  const head = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src)
  if (!head) return { fm: {}, body: src }
  return { fm: parseYamlLite(head[1]), body: src.slice(head[0].length) }
}

/** One sentence, at most 160 characters: the default answer to "这个 skill 是干什么的". */
function autoSummary(description, body) {
  let text = String(description || '').replace(/\s+/g, ' ').trim()
  if (!text) {
    text = String(body || '')
      .replace(/^#{1,6}.*$/gm, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[`*_>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (!text) return ''
  const sentence = /^(.*?[。！？!?])(?:\s|$)/.exec(text)
  let out = sentence ? sentence[1] : text
  out = out.trim()
  if (out.length > 160) out = out.slice(0, 150).trimEnd() + '…'
  return out
}

function excerptOf(body) {
  const text = String(body || '').replace(/\r\n/g, '\n').trim()
  return text.length > MAX_EXCERPT ? text.slice(0, MAX_EXCERPT).trimEnd() + '\n…' : text
}

/** Count files and bytes without walking the whole universe. */
function measureDir(dir) {
  let files = 0
  let bytes = 0
  let references = false
  let scripts = false
  const stack = [[dir, 0]]
  while (stack.length > 0 && files < 600) {
    const [current, depth] = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (files >= 600) break
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory() || (entry.isSymbolicLink() && isDir(full))) {
        if (entry.name === 'references') references = true
        if (entry.name === 'scripts') scripts = true
        if (depth < 2) stack.push([full, depth + 1])
        continue
      }
      try {
        files += 1
        bytes += fs.statSync(full).size
      } catch {}
    }
  }
  return { files, bytes, references, scripts }
}

function findSkillFile(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return null
  }
  const hit = entries.find(name => name.toLowerCase() === 'skill.md')
  return hit ? path.join(dir, hit) : null
}

/* ---------------------------------------------------------------------- 扫描 */

function builtinRoots() {
  const h = homeDir()
  const cwd = process.cwd()
  const list = [
    {
      id: 'dsh-user',
      label: 'DSH 用户技能库',
      app: 'DSH',
      kind: 'dsh',
      path: dshSkillRoot(),
      note: 'DSH 自己优先读这里；托管进来的 skill 都落在这一层',
    },
    {
      id: 'agents-shared',
      label: 'agents 共享技能库',
      app: '通用 agents',
      kind: 'agent',
      path: path.join(agentsHome(), 'skills'),
      note: 'Codex / 多个 agent 共用的标准位置',
    },
    {
      id: 'project-dsh',
      label: '当前工程 .dsh/skills',
      app: '当前工程',
      kind: 'project',
      path: path.join(cwd, '.dsh', 'skills'),
      note: 'Host 进程的工作目录：' + cwd,
    },
    {
      id: 'project-agents',
      label: '当前工程 .agents/skills',
      app: '当前工程',
      kind: 'project',
      path: path.join(cwd, '.agents', 'skills'),
      note: 'Host 进程的工作目录：' + cwd,
    },
    {
      id: 'codex',
      label: 'Codex CLI',
      app: 'Codex',
      kind: 'agent',
      path: path.join(process.env.CODEX_HOME || path.join(h, '.codex'), 'skills'),
    },
    {
      id: 'claude',
      label: 'Claude Code',
      app: 'Claude Code',
      kind: 'agent',
      path: path.join(process.env.CLAUDE_CONFIG_DIR || path.join(h, '.claude'), 'skills'),
    },
    { id: 'cursor', label: 'Cursor', app: 'Cursor', kind: 'agent', path: path.join(h, '.cursor', 'skills') },
    { id: 'gemini', label: 'Gemini CLI', app: 'Gemini CLI', kind: 'agent', path: path.join(h, '.gemini', 'skills') },
    { id: 'opencode', label: 'opencode', app: 'opencode', kind: 'agent', path: path.join(h, '.config', 'opencode', 'skills') },
    {
      id: 'trae',
      label: 'Trae CN 我的技能',
      app: 'Trae',
      kind: 'agent',
      path: path.join(h, '.trae-cn', 'skills'),
      note: 'Trae CN 的用户技能目录（~/.trae-cn/skills）',
    },
    {
      id: 'trae-builtin',
      label: 'Trae CN 内置技能',
      app: 'Trae',
      kind: 'agent',
      path: path.join(h, '.trae-cn', 'builtin_skills'),
      enabled: false,
    },
    {
      id: 'workbuddy',
      label: 'WorkBuddy 我的技能',
      app: 'WorkBuddy',
      kind: 'agent',
      path: path.join(h, '.workbuddy', 'skills'),
      note: 'WorkBuddy（CodeBuddy）用户技能目录（~/.workbuddy/skills）',
    },
    {
      id: 'workbuddy-builtin',
      label: 'WorkBuddy 内置技能',
      app: 'WorkBuddy',
      kind: 'agent',
      path: path.join(h, '.workbuddy', 'plugins', 'marketplaces', 'workbuddy-builtin', 'skills'),
      enabled: false,
      note: 'WorkBuddy 自带技能，默认不扫，勾上才进库',
    },
    {
      id: 'workbuddy-market',
      label: 'WorkBuddy 技能市场缓存',
      app: 'WorkBuddy',
      kind: 'agent',
      path: path.join(h, '.workbuddy', 'skills-marketplace', 'skills'),
      enabled: false,
      note: '市场里下载到本地的整库（数百个），默认不扫，勾上会把库撑得很大',
    },
    {
      id: 'qoder',
      label: 'Qoder 技能',
      app: 'Qoder',
      kind: 'agent',
      path: path.join(h, '.qoder', 'skills'),
      note: 'Qoder（原 Qoder CN）的用户技能目录（~/.qoder/skills）',
    },
    { id: 'windsurf', label: 'Windsurf', app: 'Windsurf', kind: 'agent', path: path.join(h, '.codeium', 'windsurf', 'skills') },
    {
      id: 'openfilm-official',
      label: 'OpenFilm 官方技能',
      app: 'OpenFilm',
      kind: 'agent',
      path: path.join(h, '.openfilm', 'skills-installed'),
    },
    { id: 'openfilm-mine', label: 'OpenFilm 我的技能', app: 'OpenFilm', kind: 'agent', path: path.join(h, 'Skills') },
  ]
  // Anything else that keeps skills in the XDG config dir (~/.config/<app>/skills).
  let configApps = []
  try {
    configApps = fs.readdirSync(path.join(h, '.config'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {}
  for (const app of configApps) {
    if (['opencode'].includes(app)) continue
    list.push({
      id: 'config-' + app,
      label: app,
      app,
      kind: 'agent',
      path: path.join(h, '.config', app, 'skills'),
    })
  }
  return list
}

function scanRoot(root) {
  const dir = root.path
  if (!isDir(dir)) return { exists: false, skills: [], error: '' }
  const skills = []
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    return { exists: true, skills: [], error: String(error && error.message) }
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    const dirLike = entry.isDirectory() || (entry.isSymbolicLink() && isDir(full))
    if (dirLike) {
      const skillFile = findSkillFile(full)
      if (!skillFile) continue
      skills.push(readSkill(full, skillFile, root, 'dir'))
      continue
    }
    if (!/\.md$/i.test(entry.name)) continue
    if (entry.name.toLowerCase() === 'readme.md') continue
    skills.push(readSkill(full, full, root, 'file'))
  }
  return { exists: true, skills, error: '' }
}

function readSkill(where, skillFile, root, kind) {
  let text = ''
  try {
    text = fs.readFileSync(skillFile, 'utf8')
  } catch {}
  const parsed = parseSkillText(text)
  const folder = kind === 'dir' ? path.basename(where) : path.basename(where, path.extname(where))
  const fmName = typeof parsed.fm.name === 'string' ? parsed.fm.name.trim() : ''
  const skillName = fmName || folder
  const measured = kind === 'dir' ? measureDir(where) : { files: 1, bytes: Buffer.byteLength(text), references: false, scripts: false }
  let mtime = 0
  try {
    mtime = fs.statSync(skillFile).mtimeMs
  } catch {}
  return {
    id: hashId(where),
    name: skillName,
    folder,
    kind,
    path: where,
    entry: skillFile,
    rootId: root.id,
    rootLabel: root.label,
    app: root.app || root.label,
    kindOfRoot: root.kind || 'agent',
    declaredName: fmName,
    description: typeof parsed.fm.description === 'string' ? parsed.fm.description : '',
    whenToUse: typeof parsed.fm.whenToUse === 'string' ? parsed.fm.whenToUse : '',
    body: parsed.body,
    excerpt: excerptOf(parsed.body),
    files: measured.files,
    bytes: measured.bytes,
    references: measured.references,
    scripts: measured.scripts,
    configs: configFilesOf(where, kind),
    envNames: withEnvFile(envNamesOf(parsed.body), where, kind),
    mtime,
  }
}

/* ------------------------------------------------------------ skill 自己的配置 */

/** 认作「可编辑配置」的文件后缀。skill 大多是纯 markdown，配置只可能在这几类文件里。 */
const CONFIG_EXT = new Set(['.json', '.env', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties', '.txt'])
const CONFIG_MAX = 262144

function configFilesOf(where, kind) {
  const out = []
  if (kind !== 'dir') return out
  let entries = []
  try {
    entries = fs.readdirSync(where, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const name = entry.name
    if (name === 'SKILL.md') continue
    const lower = name.toLowerCase()
    if (lower.endsWith('.bak')) continue
    if (lower.startsWith('.') && lower !== '.env') continue
    const looksConfig =
      CONFIG_EXT.has(path.extname(lower)) || lower.startsWith('config') || lower.startsWith('.env')
    if (!looksConfig) continue
    let bytes = 0
    try {
      bytes = fs.statSync(path.join(where, name)).size
    } catch {
      continue
    }
    if (bytes > CONFIG_MAX) continue
    out.push({ name, bytes })
  }
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return out.slice(0, 20)
}

const ENV_NOISE = new Set([
  'SKILL', 'JSON', 'HTTP', 'HTTPS', 'HTML', 'PDF', 'CSV', 'UTF', 'DSH', 'MCP', 'CLI', 'SDK',
  'GPU', 'CPU', 'RAM', 'TTS', 'RVC', 'LLM', 'VST', 'PNG', 'JPG', 'MP4', 'WAV', 'YAML', 'TOML',
  'NPM', 'PNPM', 'NODE', 'PYTHON', 'DOM', 'CDN', 'DNS', 'TLS', 'SSL', 'GRPC', 'SQL', 'ORM',
])

/** 从 SKILL.md 正文里挑出像环境变量名的东西（API_KEY / BASE_URL / *_TOKEN…），标出本机是否已设。 */
function envNamesOf(body) {
  const found = []
  const seen = new Set()
  const re = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,4}\b/g
  let match
  while ((match = re.exec(body)) !== null) {
    const name = match[0]
    if (name.length < 6 || name.length > 48) continue
    if (ENV_NOISE.has(name) || seen.has(name)) continue
    if (!/(KEY|TOKEN|SECRET|URL|ENDPOINT|HOST|PATH|DIR|HOME|ACCOUNT|USER|PASS|PORT|REGION|MODEL|BASE|API|ID)/.test(name)) continue
    seen.add(name)
    found.push({ name, set: !!(process.env[name] && String(process.env[name]).trim()) })
    if (found.length >= 12) break
  }
  return found
}

/* ---- skill 自己的 .env：把 key 写进这个 skill 目录，别的 skill 不受影响 ---- */

/** 读 .env 里已经写了的键（只看 KEY=... 行，注释和空行跳过）。 */
function envKeysOf(file) {
  const keys = new Set()
  if (!file) return keys
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return keys
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const at = trimmed.indexOf('=')
    if (at <= 0) continue
    keys.add(trimmed.slice(0, at).trim())
  }
  return keys
}

function withEnvFile(names, where, kind) {
  if (kind !== 'dir') return names
  const keys = envKeysOf(path.join(where, '.env'))
  const seen = new Set()
  const out = []
  for (const item of names || []) {
    if (seen.has(item.name)) continue
    seen.add(item.name)
    out.push(Object.assign({}, item, { inFile: keys.has(item.name) }))
  }
  // .env 里有、但 SKILL.md 没提到的变量也要列出来，否则手动加的 key 在页面上看不见、也删不掉
  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: key, set: Boolean(process.env[key]), inFile: true, extra: true })
  }
  return out
}

/** 按 id 找到 skill（只扫启用的根，够快）。 */function locateSkill(id) {
  const st = loadState()
  const off = new Set(Array.isArray(st.disabled) ? st.disabled : [])
  for (const root of allRoots(st, CFG)) {
    if (off.has(root.id)) continue
    if (!isDir(root.path)) continue
    const result = scanRoot(root)
    for (const skill of result.skills) if (skill.id === id) return skill
  }
  return undefined
}

/** 配置文件的绝对路径；名字必须是该 skill 目录下真实存在的文件，防目录穿越。 */
function configPathOf(skill, name) {
  const wanted = String(name || '')
  if (!wanted || wanted.includes('/') || wanted.includes('\\') || wanted === '..' || wanted === '.') {
    throw fail('配置文件名不合法', 400)
  }
  const target = path.join(skill.path, wanted)
  if (path.dirname(path.resolve(target)) !== path.resolve(skill.path)) throw fail('配置文件名不合法', 400)
  if (!fs.existsSync(target)) throw fail('这个配置文件不在了', 404)
  return target
}

/* ---------------------------------------------------------------------- 归类 */

/** 同一个应用 / 必须一起用的一组 skill。成员不足 2 个就不成组。 */
const APP_FAMILIES = [
  { key: 'app:ace-studio', label: 'ACE Studio', match: s => s.name.startsWith('ace-studio') },
  { key: 'app:memory', label: 'DSH 记忆（MemSearch）', match: s => s.name.startsWith('memory-') },
  { key: 'app:office', label: 'Office 文档', match: s => /^office(-|$)/.test(s.name) },
  { key: 'app:dsh', label: 'DSH 自身', match: s => s.name.startsWith('dsh-') },
  { key: 'app:mep', label: 'MEP 工作台', match: s => s.name.startsWith('mep') },
  { key: 'app:browser', label: '浏览器自动化', match: s => /browser/.test(s.name) },
  {
    key: 'app:film',
    label: '影像 / 出片',
    match: s => /openfilm|code-brand-film|remotion|body-text-motion|mv-director|fangcun|zy-cinematic|video-downloader/.test(s.name),
  },
]

/** 按"它是干什么的"分类型，命中关键词最多的那一类胜出。 */
const TYPE_FAMILIES = [
  { key: 'type:audio', label: '音频 · 音乐 · 配音', words: ['audio', 'music', 'song', 'vocal', 'voice', 'tts', '音频', '音乐', '配音', '歌声', '字幕'] },
  { key: 'type:video', label: '视频 · 影像', words: ['video', 'film', 'movie', 'cinemati', 'render', 'motion', '视频', '影像', '剪辑', '分镜', '渲染'] },
  { key: 'type:browser', label: '浏览器 · 网页', words: ['browser', 'webpage', 'web page', 'chromium', '网页', '网站', '浏览器'] },
  { key: 'type:office', label: '文档 · 办公', words: ['docx', 'xlsx', 'pptx', 'pdf', 'office', 'spreadsheet', '文档', '表格', '演示', '排版'] },
  { key: 'type:code', label: '编码 · 工程', words: ['code', 'repo', 'refactor', 'test', 'build', 'commit', '代码', '重构', '工程'] },
  { key: 'type:memory', label: '记忆 · 上下文', words: ['memory', 'recall', 'context', '记忆', '上下文', '回忆'] },
  { key: 'type:design', label: '设计 · 视觉', words: ['design', 'ui', 'ux', 'visual', 'image', 'icon', '设计', '视觉', '配色', '画面'] },
  { key: 'type:meta', label: '元能力 · 造技能', words: ['skill', 'distill', 'skill-creator', '方法论', '蒸馏', '拆书', '技能'] },
  { key: 'type:ops', label: '部署 · 运维', words: ['deploy', 'docker', 'install', 'server', '部署', '安装', '运维'] },
]

function typeOf(skill) {
  const haystack = (skill.name + ' ' + skill.description + ' ' + skill.folder).toLowerCase()
  let best = null
  let bestScore = 0
  for (const family of TYPE_FAMILIES) {
    let score = 0
    for (const word of family.words) if (haystack.includes(word.toLowerCase())) score += 1
    if (score > bestScore) {
      best = family
      bestScore = score
    }
  }
  return best ? best.key : 'type:other'
}

function classify(skills, st) {
  const labels = new Map()
  const order = []
  for (const family of APP_FAMILIES) labels.set(family.key, family.label)
  for (const family of TYPE_FAMILIES) labels.set(family.key, family.label)
  labels.set('type:other', '其它')
  labels.set(NONE, '未归类')
  for (const category of st.categories) {
    if (category && category.key) labels.set(category.key, category.label || category.key)
  }

  const assigned = new Map()
  const members = new Map(APP_FAMILIES.map(family => [family.key, []]))
  for (const skill of skills) {
    for (const family of APP_FAMILIES) {
      if (family.match(skill)) members.get(family.key).push(skill.id)
    }
  }
  for (const family of APP_FAMILIES) {
    const list = members.get(family.key)
    if (list.length >= 2) for (const id of list) if (!assigned.has(id)) assigned.set(id, family.key)
  }
  for (const skill of skills) {
    if (!assigned.has(skill.id)) assigned.set(skill.id, typeOf(skill))
  }
  // A manual choice always wins, including "leave it out of every group".
  for (const [id, key] of Object.entries(st.assignments || {})) {
    if (typeof key !== 'string' || !key) continue
    if (skills.some(skill => skill.id === id)) assigned.set(id, key)
  }

  // 类型对不上任何内置分类的（原来会掉进「其它」），按来源应用自动建一组，免得要手工建
  for (const skill of skills) {
    if (assigned.get(skill.id) !== 'type:other') continue
    if (st.assignments && st.assignments[skill.id]) continue
    const appName = String(skill.app || '').trim() || '其它'
    const autoKey = 'type:auto:' + appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    assigned.set(skill.id, autoKey)
    if (!labels.has(autoKey)) labels.set(autoKey, appName + '（自动）')
  }

  const counts = new Map()
  for (const key of assigned.values()) counts.set(key, (counts.get(key) || 0) + 1)

  const categories = []
  const push = (key, kind) => {
    const count = counts.get(key) || 0
    if (!count) return
    categories.push({ key, label: labels.get(key) || key, kind, count })
    order.push(key)
  }
  for (const family of APP_FAMILIES) push(family.key, 'app')
  for (const family of TYPE_FAMILIES) push(family.key, 'type')
  for (const key of [...counts.keys()]) if (key.startsWith('type:auto:')) push(key, 'type')
  if (counts.get('type:other')) push('type:other', 'type')
  for (const category of st.categories) {
    // 自己建的分类即使还没有成员也要显示，否则新建完看不到建在哪
    if (category && category.key) {
      const count = counts.get(category.key) || 0
      categories.push({ key: category.key, label: labels.get(category.key) || category.key, kind: 'user', count })
      order.push(category.key)
    }
  }
  if (counts.get(NONE)) push(NONE, 'none')
  return { assigned, categories }
}

/* ---------------------------------------------------------------------- 模型 */

function allRoots(st, config) {
  const configRoots = []
  const extra = Array.isArray(config && config.roots) ? config.roots : []
  extra.forEach((entry, index) => {
    const p = typeof entry === 'string' ? entry : entry && entry.path
    if (!p) return
    configRoots.push({
      id: 'config-' + index,
      label: (entry && entry.label) || path.basename(p) || p,
      app: (entry && entry.app) || '自定义',
      kind: 'custom',
      path: path.resolve(p),
      config: true,
    })
  })
  const seen = new Set()
  const out = []
  for (const root of [...builtinRoots(), ...st.roots, ...configRoots]) {
    if (!root || !root.path) continue
    const key = normKey(root.path)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: root.id,
      label: root.label || root.id,
      app: root.app || root.label || root.id,
      kind: root.kind || 'custom',
      path: root.path,
      note: root.note || '',
      custom: root.kind === 'custom',
      enabled: root.enabled !== false,
    })
  }
  return out
}

function buildModel(config) {
  const st = loadState()
  const roots = allRoots(st, config)
  const off = new Set(Array.isArray(st.disabled) ? st.disabled : [])
  for (const root of roots) if (off.has(root.id)) root.enabled = false
  const raw = []
  const warnings = []
  for (const root of roots) {
    if (!root.enabled) {
      root.exists = isDir(root.path)
      root.count = 0
      continue
    }
    const result = scanRoot(root)
    root.exists = result.exists
    root.count = result.skills.length
    if (result.error) warnings.push(root.label + '：' + result.error)
    for (const skill of result.skills) raw.push(skill)
  }

  // One skill can be reachable from several roots (junctions, project copies): keep the first,
  // and remember where else the same skill name is installed.
  const seenPath = new Map()
  const seenName = new Map()
  const skills = []
  for (const skill of raw) {
    const pathKey = normKey(skill.path)
    if (seenPath.has(pathKey)) continue
    seenPath.set(pathKey, skill)
    const nameKey = skill.name.toLowerCase()
    const twin = seenName.get(nameKey)
    if (twin) {
      twin.alsoAt.push(skill.path)
      continue
    }
    skill.alsoAt = []
    seenName.set(nameKey, skill)
    skills.push(skill)
  }

  // Adoption records: a junction in the old place points at the copy in the DSH root.
  const adoptedByName = new Map()
  for (const [name, record] of Object.entries(st.adopted || {})) {
    if (record && record.to) adoptedByName.set(normKey(record.to), { name, ...record })
  }

  const { assigned, categories } = classify(skills, st)

  const enriched = skills.map(skill => {
    const own = st.summaries[skill.id]
    const manual = own && own.source === 'user' && typeof own.text === 'string'
    const ownName = st.names && st.names[skill.id]
    const customName = ownName && typeof ownName.text === 'string' && ownName.text.trim() ? ownName.text.trim() : ''
    const zh = ZH_SUMMARY[skill.name] || ''
    const record = adoptedByName.get(normKey(skill.path))
    const inDsh = normKey(skill.path).startsWith(normKey(dshSkillRoot()) + (IS_WIN ? '\\' : '/'))
    const categoryKey = assigned.get(skill.id) || 'type:other'
    return {
      id: skill.id,
      name: skill.name,
      displayName: customName || skill.name,
      nameSource: customName ? 'user' : 'original',
      folder: skill.folder,
      kind: skill.kind,
      path: skill.path,
      entry: skill.entry,
      rootId: skill.rootId,
      rootLabel: skill.rootLabel,
      app: skill.app,
      summary: manual ? own.text : zh || autoSummary(skill.description, skill.body),
      summarySource: manual ? 'user' : zh ? 'zh' : 'auto',
      summaryEdited: Boolean(manual),
      description: skill.description,
      whenToUse: skill.whenToUse,
      excerpt: skill.excerpt,
      files: skill.files,
      bytes: skill.bytes,
      references: skill.references,
      scripts: skill.scripts,
      configs: skill.configs || [],
      envNames: skill.envNames || [],
      mtime: skill.mtime,
      categoryKey,
      categorySource: st.assignments[skill.id] ? 'manual' : 'auto',
      adopted: Boolean(record),
      adoptedFrom: record ? record.from : '',
      alsoAt: skill.alsoAt || [],
      inDshRoot: inDsh,
      link: isLink(skill.path),
    }
  })

  enriched.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0))

  const byId = new Map(enriched.map(skill => [skill.id, skill]))
  const combos = st.combos.map(combo => {
    const items = Array.isArray(combo.items) ? combo.items : []
    const members = items.map(id => byId.get(id)).filter(Boolean)
    return {
      id: combo.id,
      name: combo.name || '未命名组合',
      note: combo.note || '',
      items: items.slice(),
      skills: members.map(skill => ({ id: skill.id, name: skill.displayName || skill.name, slug: skill.name, app: skill.app, categoryKey: skill.categoryKey })),
      missing: items.filter(id => !byId.has(id)),
      createdAt: combo.createdAt || '',
      updatedAt: combo.updatedAt || '',
      callText: callTextFor(combo, members),
    }
  })

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    stateFile: stateFile(),
    dshSkillRoot: dshSkillRoot(),
    platform: process.platform,
    roots,
    skills: enriched,
    categories,
    combos,
    adopted: Object.entries(st.adopted || {}).map(([name, record]) => ({ name, ...record })),
    stats: {
      skills: enriched.length,
      roots: roots.filter(root => root.exists).length,
      rootsTotal: roots.length,
      combos: combos.length,
      categories: categories.length,
      adopted: Object.keys(st.adopted || {}).length,
      bytes: enriched.reduce((sum, skill) => sum + (skill.bytes || 0), 0),
    },
    warnings,
  }
}

function callTextFor(combo, members) {
  const names = members.map(skill => '`' + skill.name + '`')
  if (names.length === 0) return ''
  const line = '请先加载这些 skill，再开始做：' + names.join('、')
  return combo && combo.name ? line + '（Skill 中心组合「' + combo.name + '」）' : line
}

/* ---------------------------------------------------------------------- 动作 */

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

function findSkillOrThrow(model, id) {
  const skill = model.skills.find(entry => entry.id === id)
  if (!skill) throw fail('找不到这个 skill，可能已经被移动或删除', 404)
  return skill
}

function adoptSkill(id) {
  const st = loadState()
  const model = buildModel(CFG)
  const skill = findSkillOrThrow(model, id)
  if (skill.kind !== 'dir') throw fail('只有目录形式的 skill（<name>/SKILL.md）可以托管；单文件 skill 请手动复制', 400)
  const targetRoot = dshSkillRoot()
  const target = path.join(targetRoot, path.basename(skill.path))
  if (normKey(skill.path) === normKey(target)) throw fail('这个 skill 已经在 DSH 技能库里了', 400)
  if (normKey(skill.path).startsWith(normKey(targetRoot) + (IS_WIN ? '\\' : '/'))) {
    throw fail('这个 skill 已经在 DSH 技能库里了', 400)
  }
  if (isLink(skill.path)) throw fail('这个 skill 本身已经是一个链接，先还原它再托管', 400)
  if (fs.existsSync(target)) throw fail('DSH 技能库里已有同名目录：' + target, 409)
  fs.mkdirSync(targetRoot, { recursive: true })
  moveDir(skill.path, target)
  try {
    fs.symlinkSync(target, skill.path, IS_WIN ? 'junction' : 'dir')
  } catch (error) {
    try {
      moveDir(target, skill.path)
    } catch {}
    throw fail('移动成功但建链接失败，已还原：' + String(error && error.message), 500)
  }
  st.adopted[skill.folder] = { from: skill.path, to: target, at: new Date().toISOString() }
  saveState(st)
  return { message: '已托管到 ' + target + '，原位置留了一个链接：' + skill.path }
}

function restoreSkill(name) {
  const st = loadState()
  const record = st.adopted[name]
  if (!record) throw fail('没有这个托管记录：' + name, 404)
  if (!isDir(record.to)) throw fail('DSH 里的副本不见了：' + record.to, 404)
  if (fs.existsSync(record.from) && !isLink(record.from)) {
    throw fail('原位置已经有一个真实目录，先处理它：' + record.from, 409)
  }
  if (isLink(record.from)) removeLink(record.from)
  fs.mkdirSync(path.dirname(record.from), { recursive: true })
  moveDir(record.to, record.from)
  delete st.adopted[name]
  saveState(st)
  return { message: '已还回原位：' + record.from }
}

function comboOf(st, id) {
  const combo = st.combos.find(entry => entry && entry.id === id)
  if (!combo) throw fail('找不到这个组合', 404)
  return combo
}

async function applyAction(input) {
  const st = loadState()
  const action = String(input.action || '')
  const model = () => buildModel(CFG)

  switch (action) {
    case 'clientLog': {
      // 浏览器那边开不出右栏页签时把真实报错写下来，省得靠截图猜。
      try {
        fs.mkdirSync(stateDir(), { recursive: true })
        fs.appendFileSync(
          path.join(stateDir(), 'client.log'),
          JSON.stringify({ at: new Date().toISOString(), message: String(input.message || '') }) + '\n',
          'utf8'
        )
      } catch (error) { /* 写不进去就算了 */ }
      return { message: '' }
    }

    case 'rescan':
      return { model: model(), message: '已重新扫描' }

    case 'writeEnv': {
      const skill = locateSkill(String(input.id || ''))
      if (!skill) throw fail('找不到这个 skill', 404)
      if (skill.kind !== 'dir') throw fail('这个 skill 是单文件，没有目录可以放 .env', 400)
      const key = String(input.name || '').trim()
      if (!/^[A-Z][A-Z0-9_]{2,47}$/.test(key)) throw fail('变量名不合法（大写字母、数字、下划线）', 400)
      const value = String(input.value === undefined || input.value === null ? '' : input.value)
      if (/[\r\n]/.test(value)) throw fail('值里不能换行', 400)
      if (Buffer.byteLength(value) > 4096) throw fail('值太长了（上限 4KB）', 400)
      const file = path.join(skill.path, '.env')
      let lines = []
      try {
        lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
      } catch {
        lines = []
      }
      while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
      let replaced = false
      const out = []
      for (const line of lines) {
        const trimmed = line.trim()
        const at = trimmed.indexOf('=')
        const name = at > 0 && !trimmed.startsWith('#') ? trimmed.slice(0, at).trim() : ''
        if (name === key) {
          if (!replaced) {
            replaced = true
            if (value) out.push(key + '=' + value)
          }
          continue
        }
        out.push(line)
      }
      if (!replaced && value) out.push(key + '=' + value)
      try {
        if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak')
        if (out.length) fs.writeFileSync(file, out.join('\n') + '\n', 'utf8')
        else {
          try {
            fs.unlinkSync(file)
          } catch {}
        }
      } catch (error) {
        throw fail('写不进去：' + ((error && error.message) || error), 500)
      }
      return {
        model: model(),
        message: value ? '已写入 .env：' + key : '已从 .env 删掉 ' + key,
      }
    }

    case 'readConfig': {
      const skill = locateSkill(String(input.id || ''))
      if (!skill) throw fail('找不到这个 skill', 404)
      const file = configPathOf(skill, input.name)
      let text = ''
      try {
        text = fs.readFileSync(file, 'utf8')
      } catch (error) {
        throw fail('读不出来：' + ((error && error.message) || error), 500)
      }
      return { model: null, config: { name: String(input.name || ''), text } }
    }

    case 'writeConfig': {
      const skill = locateSkill(String(input.id || ''))
      if (!skill) throw fail('找不到这个 skill', 404)
      const file = configPathOf(skill, input.name)
      const text = String(input.text === undefined || input.text === null ? '' : input.text)
      if (Buffer.byteLength(text) > CONFIG_MAX) throw fail('文件太大了，超过 256KB', 400)
      if (String(input.name || '').toLowerCase().endsWith('.json') && text.trim()) {
        try {
          JSON.parse(text)
        } catch (error) {
          throw fail('JSON 格式不对：' + ((error && error.message) || error), 400)
        }
      }
      try {
        fs.copyFileSync(file, file + '.bak')
        fs.writeFileSync(file, text, 'utf8')
      } catch (error) {
        throw fail('写不进去：' + ((error && error.message) || error), 500)
      }
      return { model: model(), message: '已保存，原文件备份成 ' + String(input.name || '') + '.bak' }
    }

    case 'setSummary': {
      const id = String(input.id || '')
      if (!model().skills.some(skill => skill.id === id)) throw fail('找不到这个 skill', 404)
      const text = String(input.text || '').trim()
      if (!text) {
        delete st.summaries[id]
      } else {
        st.summaries[id] = { text, source: 'user', at: new Date().toISOString() }
      }
      saveState(st)
      return { model: model(), message: '说明已保存' }
    }

    case 'resetSummary': {
      delete st.summaries[String(input.id || '')]
      saveState(st)
      return { model: model(), message: '已恢复自动整理的说明' }
    }

    case 'assign': {
      const id = String(input.id || '')
      const key = String(input.categoryKey || '')
      if (key) st.assignments[id] = key
      else delete st.assignments[id]
      saveState(st)
      return { model: model(), message: '归类已更新' }
    }

    case 'assignMany': {
      const ids = Array.isArray(input.ids) ? input.ids : []
      const key = String(input.categoryKey || '')
      for (const id of ids) {
        if (key) st.assignments[id] = key
        else delete st.assignments[id]
      }
      saveState(st)
      return { model: model(), message: '已更新 ' + ids.length + ' 个 skill 的归类' }
    }

    case 'createCategory': {
      const label = String(input.label || '').trim()
      if (!label) throw fail('先给分类起个名字', 400)
      const key = 'user:' + createHash('sha1').update(label + Date.now()).digest('hex').slice(0, 8)
      st.categories.push({ key, label, at: new Date().toISOString() })
      saveState(st)
      return { model: model(), message: '已新建分类「' + label + '」' }
    }

    case 'renameCategory': {
      const key = String(input.key || '')
      const label = String(input.label || '').trim()
      const category = st.categories.find(entry => entry.key === key)
      if (!category) throw fail('只有自己建的分类可以改名', 400)
      if (!label) throw fail('名字不能为空', 400)
      category.label = label
      saveState(st)
      return { model: model(), message: '已改名' }
    }

    case 'deleteCategory': {
      const key = String(input.key || '')
      st.categories = st.categories.filter(entry => entry.key !== key)
      for (const [id, value] of Object.entries(st.assignments)) if (value === key) delete st.assignments[id]
      saveState(st)
      return { model: model(), message: '已删除分类' }
    }

    case 'createCombo': {
      const comboName = String(input.name || '').trim() || '新组合'
      const combo = {
        id: uid('combo'),
        name: comboName,
        note: String(input.note || ''),
        items: Array.isArray(input.items) ? input.items.slice() : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      st.combos.push(combo)
      saveState(st)
      return { model: model(), message: '已新建组合「' + comboName + '」', comboId: combo.id }
    }

    case 'updateCombo': {
      const combo = comboOf(st, String(input.id || ''))
      if (typeof input.name === 'string') combo.name = input.name.trim() || combo.name
      if (typeof input.note === 'string') combo.note = input.note
      if (Array.isArray(input.items)) combo.items = input.items.slice()
      combo.updatedAt = new Date().toISOString()
      saveState(st)
      return { model: model(), message: '组合已保存' }
    }

    case 'deleteCombo': {
      const id = String(input.id || '')
      st.combos = st.combos.filter(entry => entry.id !== id)
      saveState(st)
      return { model: model(), message: '已删除组合' }
    }

    case 'toggleComboItem': {
      const combo = comboOf(st, String(input.comboId || ''))
      const id = String(input.id || '')
      const items = Array.isArray(combo.items) ? combo.items.slice() : []
      const at = items.indexOf(id)
      if (at >= 0) items.splice(at, 1)
      else items.push(id)
      combo.items = items
      combo.updatedAt = new Date().toISOString()
      saveState(st)
      return { model: model(), message: '' }
    }

    case 'addRoot': {
      const raw = String(input.path || '').trim()
      if (!raw) throw fail('先填一个目录', 400)
      const resolved = path.resolve(raw)
      if (!isDir(resolved)) throw fail('这个目录不存在：' + resolved, 400)
      if (allRoots(st, CFG).some(root => normKey(root.path) === normKey(resolved))) {
        throw fail('这个目录已经在列表里了', 409)
      }
      st.roots.push({
        id: uid('root'),
        label: String(input.label || '').trim() || path.basename(resolved) || resolved,
        app: String(input.app || '').trim() || '自定义',
        kind: 'custom',
        path: resolved,
      })
      saveState(st)
      return { model: model(), message: '已加入：' + resolved }
    }

    case 'removeRoot': {
      const id = String(input.id || '')
      st.roots = st.roots.filter(entry => entry.id !== id)
      saveState(st)
      return { model: model(), message: '已移出列表' }
    }

    case 'toggleRoot': {
      const id = String(input.id || '')
      const enabled = Boolean(input.enabled)
      const custom = st.roots.find(entry => entry.id === id)
      if (custom) custom.enabled = enabled
      else {
        if (!Array.isArray(st.disabled)) st.disabled = []
        st.disabled = st.disabled.filter(value => value !== id)
        if (!enabled) st.disabled.push(id)
      }
      saveState(st)
      return { model: model(), message: enabled ? '已启用' : '已停用' }
    }

    case 'adopt':
      return { model: model(), message: adoptSkill(String(input.id || '')).message }

    case 'restore':
      return { model: model(), message: restoreSkill(String(input.name || '')).message }

    case 'openFolder': {
      const target = String(input.path || '')
      if (!target || !fs.existsSync(target)) throw fail('路径不存在：' + target, 404)
      try {
        const child = spawn(IS_WIN ? 'explorer.exe' : 'open', [target], { detached: true, stdio: 'ignore' })
        child.unref()
      } catch (error) {
        throw fail('打不开文件管理器：' + String(error && error.message), 500)
      }
      return { model: null, message: '已打开：' + target }
    }

    case 'writeEnvMany': {
      const skill = locateSkill(String(input.id || ''))
      if (skill.kind !== 'dir') throw fail('这个 skill 是单文件，没有目录可以放 .env')
      const entries = Array.isArray(input.entries) ? input.entries : []
      if (entries.length === 0) throw fail('没有要写的变量')
      const file = path.join(skill.path, '.env')
      const pairs = []
      for (const entry of entries) {
        const name = String((entry && entry.name) || '').trim()
        const value = String((entry && entry.value) == null ? '' : entry.value)
        if (!/^[A-Z][A-Z0-9_]{2,47}$/.test(name)) throw fail('变量名不合法（大写字母、数字、下划线）：' + name)
        if (/[\r\n]/.test(value)) throw fail('值里不能换行：' + name)
        if (value.length > 4096) throw fail('值太长了：' + name)
        pairs.push([name, value])
      }
      const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : []
      if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak')
      for (const [name, value] of pairs) {
        const at = lines.findIndex(line => new RegExp('^\\s*' + name + '\\s*=').test(line))
        if (value === '') {
          if (at !== -1) lines.splice(at, 1)
        } else if (at === -1) {
          lines.push(name + '=' + value)
        } else {
          lines[at] = name + '=' + value
        }
      }
      const text = lines.filter((line, index) => line !== '' || index < lines.length - 1).join('\n')
      fs.writeFileSync(file, text.endsWith('\n') ? text : text + '\n', 'utf8')
      const written = pairs.filter(pair => pair[1] !== '').map(pair => pair[0])
      const cleared = pairs.filter(pair => pair[1] === '').map(pair => pair[0])
      const parts = []
      if (written.length) parts.push('已写入 .env：' + written.join('、'))
      if (cleared.length) parts.push('已从 .env 删掉：' + cleared.join('、'))
      return { model: model(), message: parts.join('；') || '没有改动' }
    }

    case 'plugins':
      return { plugins: await pluginModel(), message: '' }

    case 'setPluginSummary': {
      const target = String(input.name || '').trim()
      if (!target) throw fail('缺少插件名', 400)
      const text = String(input.text == null ? '' : input.text).replace(/\r\n/g, '\n').trim()
      if (!text) {
        delete st.pluginSummaries[target]
        saveState(st)
        return { model: model(), message: '已恢复默认说明' }
      }
      if (text.length > 2000) throw fail('说明太长了（上限 2000 字）', 400)
      st.pluginSummaries[target] = { text, source: 'user', at: new Date().toISOString() }
      saveState(st)
      return { model: model(), message: '已保存这个插件的说明' }
    }

    case 'resetPluginSummary': {
      const target = String(input.name || '').trim()
      if (!target) throw fail('缺少插件名', 400)
      delete st.pluginSummaries[target]
      saveState(st)
      return { model: model(), message: '已恢复默认说明' }
    }

    case 'setName': {
      const id = String(input.id || '').trim()
      if (!id) throw fail('缺少 skill id', 400)
      const text = String(input.text == null ? '' : input.text).replace(/\s+/g, ' ').trim()
      if (!text) {
        delete st.names[id]
        saveState(st)
        return { model: model(), message: '已恢复原名' }
      }
      if (text.length > 60) throw fail('名字太长了（上限 60 字）', 400)
      st.names[id] = { text, source: 'user', at: new Date().toISOString() }
      saveState(st)
      return { model: model(), message: '已改名（只在这个中心里显示，不动它原来的名字）' }
    }

    case 'resetName': {
      const id = String(input.id || '').trim()
      if (!id) throw fail('缺少 skill id', 400)
      delete st.names[id]
      saveState(st)
      return { model: model(), message: '已恢复原名' }
    }

    case 'setPluginName': {
      const target = String(input.name || '').trim()
      if (!target) throw fail('缺少插件名', 400)
      const text = String(input.text == null ? '' : input.text).replace(/\s+/g, ' ').trim()
      if (!text) {
        delete st.pluginNames[target]
        saveState(st)
        return { message: '已恢复原名' }
      }
      if (text.length > 60) throw fail('名字太长了（上限 60 字）', 400)
      st.pluginNames[target] = { text, source: 'user', at: new Date().toISOString() }
      saveState(st)
      return { message: '已改名（只在这个中心里显示，不动插件本身的名字）' }
    }

    case 'resetPluginName': {
      const target = String(input.name || '').trim()
      if (!target) throw fail('缺少插件名', 400)
      delete st.pluginNames[target]
      saveState(st)
      return { message: '已恢复原名' }
    }

    case 'setPluginEnabled': {
      const target = String(input.name || '').trim()
      if (!target) throw fail('缺少插件名', 400)
      if (target === SELF && input.enabled === false) {
        throw fail('不能在这里停用 Skill 中心自己（页面会立刻消失）', 400)
      }
      if (!PM || typeof PM.setBundleEnabled !== 'function') throw fail('没有拿到插件管理服务', 500)
      const enabled = input.enabled !== false
      const result = await PM.setBundleEnabled(target, enabled)
      const state = result && (result.application || result.stage) ? '（' + (result.application || result.stage) + '）' : ''
      return { message: (enabled ? '已启用 ' : '已停用 ') + target + state }
    }

    case 'readPluginConfig': {
      const file = pluginConfigPathAny(String(input.name || ''), input)
      const stat = fs.statSync(file)
      if (stat.size > CONFIG_MAX) throw fail('这个文件太大了，不适合在页面里改', 400)
      return { config: { name: path.basename(file), path: file, text: fs.readFileSync(file, 'utf8') } }
    }

    case 'writePluginConfig': {
      const file = pluginConfigPathAny(String(input.name || ''), input)
      const text = String(input.text == null ? '' : input.text)
      if (Buffer.byteLength(text, 'utf8') > CONFIG_MAX) throw fail('内容太长（上限 256KB）', 400)
      if (path.extname(file).toLowerCase() === '.json') {
        try {
          JSON.parse(text)
        } catch (error) {
          throw fail('JSON 格式不对：' + (error && error.message ? error.message : error), 400)
        }
      }
      if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak-skill-center')
      fs.writeFileSync(file, text, 'utf8')
      return { message: '已保存 ' + path.basename(file) + '，原文件备份成 .bak-skill-center' }
    }

    case 'openPluginFolder': {
      const dir = packageDirOf(String(input.name || ''))
      if (!dir) throw fail('找不到这个插件的安装目录', 404)
      try {
        const child = spawn(IS_WIN ? 'explorer.exe' : 'xdg-open', [dir], { detached: true, stdio: 'ignore' })
        child.unref()
      } catch (error) {
        throw fail('打不开目录：' + (error && error.message ? error.message : error), 500)
      }
      return { message: '已在文件管理器里打开' }
    }

    case 'pluginStructure':
      return pluginStructure(String(input.name || ''), input)

    case 'setPluginField':
      return setPluginField(String(input.name || ''), input)

    case 'setProfileField':
      return setProfileField(String(input.name || ''), input)

    case 'writeDshEnv':
      return writeDshEnvVar(input)

    case 'addPluginField':
      return addPluginField(String(input.name || ''), input)

    case 'removePluginField':
      return removePluginField(String(input.name || ''), input)

    case 'openPluginData':
      return openPluginData(String(input.name || ''), input)

    case 'openPluginDir':
      return openPluginDir(String(input.name || ''), input)

    case 'openExternal': {
      const url = String(input.url || '')
      if (!/^https?:\/\//i.test(url)) throw fail('只支持 http/https 链接', 400)
      try {
        spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
      } catch (error) {
        throw fail('打开浏览器失败：' + (error && error.message ? error.message : String(error)), 500)
      }
      return { message: '已在浏览器里打开' }
    }

    case 'deleteSkill': {
      const id = String(input.id || '')
      const skill = locateSkill(id)
      if (!skill) throw fail('找不到这个 skill（可能已经删掉了）', 404)
      if (skill.link) throw fail('这个 skill 是指向别处的链接（托管过来的），先在「来源与托管」里还原再删', 400)
      const roots = allRoots(loadState(), CFG).map((root) => path.resolve(root.path))
      const target = path.resolve(skill.path)
      if (!roots.some((root) => target === root || target.startsWith(root + path.sep))) {
        throw fail('这个 skill 不在已登记的技能目录里，为了安全不删', 400)
      }
      const label = skill.displayName || skill.name
      delete st.summaries[skill.id]
      delete st.assignments[skill.id]
      if (st.names) delete st.names[skill.id]
      st.combos = (st.combos || []).map((combo) => Object.assign({}, combo, {
        items: (combo.items || []).filter((x) => x !== skill.id),
      }))
      saveState(st)
      try {
        if (skill.kind === 'dir') fs.rmSync(skill.path, { recursive: true, force: true })
        else fs.unlinkSync(skill.path)
      } catch (error) {
        throw fail('删除失败：' + (error && error.message ? error.message : String(error)), 500)
      }
      return { model: model(), message: '已从本地删除 ' + label }
    }

    case 'deletePlugin': {
      const name = String(input.name || '')
      if (name === SELF) throw fail('不能删除 Skill 中心自己（页面会立刻消失）', 400)
      if (!PM) throw fail('没有拿到 DSH 的插件管理服务（pluginManager）', 500)
      const bundles = await PM.listBundles()
      const info = bundles.find((entry) => entry.name === name)
      if (!info) throw fail('找不到这个插件', 404)
      if (info.availability === 'installation') throw fail('这个插件是随 DSH 安装的，删不掉，只能停用', 400)
      if (info.removable === false) throw fail('这个插件不允许删除', 400)
      let result
      try {
        result = await PM.removeBundle(name)
      } catch (error) {
        throw fail('删除失败：' + (error && error.message ? error.message : String(error)), 500)
      }
      const note = result && result.application ? '（' + result.application + '）' : ''
      return { model: null, message: '已从 DSH 卸载插件 ' + name + note }
    }

    case 'testEndpoint':
      return testEndpoint(input)

    default:
      throw fail('未知操作：' + action, 400)
  }
}

/* ---------------------------------------------------------------- 模型 / API */

const TEST_TIMEOUT_MS = 9000

function dshEnvPath() {
  return path.join(dshHome(), '.env')
}

/** Parse `~/.dsh/.env` into a plain map (values are not returned to the client). */
function envFileMap() {
  const map = {}
  let text = ''
  try {
    text = fs.readFileSync(dshEnvPath(), 'utf8')
  } catch {
    return map
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    map[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return map
}

async function probe(base, apiKey, model) {
  const headers = { 'content-type': 'application/json' }
  if (apiKey) headers.authorization = 'Bearer ' + apiKey
  const steps = []
  const started = Date.now()
  let models = []

  try {
    const res = await fetch(base + '/models', { headers, signal: AbortSignal.timeout(TEST_TIMEOUT_MS) })
    const text = await res.text()
    steps.push('GET /models → ' + res.status)
    if (res.ok) {
      try {
        const body = JSON.parse(text)
        const list = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : []
        models = list.map((item) => item.id || item.name).filter(Boolean).slice(0, 12)
      } catch {}
      return {
        ok: true,
        reachable: true,
        stage: 'models',
        ms: Date.now() - started,
        status: res.status,
        models,
        steps,
        detail: models.length ? '列出了 ' + models.length + ' 个模型' : '接口通了，但没列出模型',
      }
    }
  } catch (error) {
    steps.push('GET /models → ' + String((error && error.message) || error))
  }

  try {
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || (models[0] || 'default'),
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    })
    const text = await res.text()
    steps.push('POST /chat/completions → ' + res.status)
    const snippet = text.slice(0, 300)
    if (res.ok) {
      return {
        ok: true, reachable: true, stage: 'chat', ms: Date.now() - started, status: res.status,
        models, steps, detail: '能正常对话（' + (model || '默认模型') + '）',
      }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false, reachable: true, stage: 'chat', ms: Date.now() - started, status: res.status,
        models, steps, detail: '地址通，但 key 被拒绝（' + res.status + '）',
      }
    }
    return {
      ok: false, reachable: true, stage: 'chat', ms: Date.now() - started, status: res.status,
      models, steps, detail: '地址通，但请求被拒（' + res.status + '）：' + snippet,
    }
  } catch (error) {
    steps.push('POST /chat/completions → ' + String((error && error.message) || error))
    return {
      ok: false, reachable: false, stage: 'connect', ms: Date.now() - started, status: 0,
      models, steps, detail: '连不上：' + String((error && error.message) || error),
    }
  }
}

async function testEndpoint(input) {
  const raw = String((input && input.baseURL) || '').trim().replace(/\/+$/, '')
  if (!raw) throw fail('先填一个地址')
  if (!/^https?:\/\/\S+$/i.test(raw)) throw fail('地址要以 http:// 或 https:// 开头')
  const envName = String((input && input.apiKeyEnv) || '').trim()
  const key = String((input && input.apiKey) || '').trim()
    || (envName ? (process.env[envName] || envFileMap()[envName] || '') : '')
  const model = String((input && input.model) || '').trim()
  const result = await probe(raw, key, model)
  return { model: null, test: Object.assign({ baseURL: raw, keyUsed: Boolean(key) }, result) }
}

/* ---------------------------------------------------------------------- 插件 */

/** DSH 的插件管理服务（PluginManager），在 apply 里通过 ctx.inject 拿到。 */
let PM = null

function profileDir() {
  return process.env.DSH_PROFILE_DIR || path.join(dshHome(), 'profiles', 'desktop')
}

/** 安装目录里的 node_modules（内置 bundle 在这里，只读）。 */
function installNodeModules() {
  const dir = process.env.DSH_INSTALL_DIR || ''
  if (!dir) return ''
  return path.resolve(dir, '..', '..')
}

/** 插件名 → 安装目录（先看 profile 里装的，再看安装自带的）。 */
function packageDirOf(name) {
  const clean = String(name || '').trim()
  if (!clean || clean.includes('..')) return ''
  const roots = [path.join(profileDir(), 'node_modules')]
  const install = installNodeModules()
  if (install) roots.push(install)
  for (const root of roots) {
    const dir = path.join(root, clean)
    if (isDir(dir) && isFile(path.join(dir, 'package.json'))) return dir
  }
  return ''
}

const CARD_CACHE = new Map()

/** 读插件的浏览器半入口，判断它有没有注册 plugins.bundle.config（原生配置卡片）。 */
function hasConfigCard(dir) {
  if (!dir || dir.toLowerCase().includes('.asar')) return null
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  let entry = ''
  const ex = pkg && pkg.exports
  if (ex && typeof ex === 'object') {
    const sub = ex['./client']
    if (typeof sub === 'string') entry = sub
    else if (sub && typeof sub === 'object') entry = sub.default || sub.import || sub.require || ''
  }
  if (!entry && pkg && pkg.dsh && pkg.dsh.client && typeof pkg.dsh.client.entry === 'string') entry = pkg.dsh.client.entry
  const candidates = [entry, 'client/client.js', 'client.js', 'dist/client.js', 'index.js'].filter(Boolean)
  for (const candidate of candidates) {
    const file = path.resolve(dir, candidate)
    let stat
    try {
      stat = fs.statSync(file)
    } catch {
      continue
    }
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) continue
    const key = file + '|' + stat.mtimeMs
    if (CARD_CACHE.has(key)) return CARD_CACHE.get(key)
    let hit = false
    try {
      hit = fs.readFileSync(file, 'utf8').includes('plugins.bundle.config')
    } catch {
      hit = false
    }
    CARD_CACHE.set(key, hit)
    return hit
  }
  return null
}

/** 插件元数据里的 description 可能是多语言对象（{zh,en}），React 拿对象当子节点会直接崩，这里统一压成字符串。 */
function localizedText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const order = ['zh', 'zh-CN', 'zh_cn', 'en', 'default']
    for (const key of order) {
      const hit = value[key]
      if (typeof hit === 'string' && hit) return hit
    }
    for (const key of Object.keys(value)) {
      if (typeof value[key] === 'string' && value[key]) return value[key]
    }
    return ''
  }
  return String(value)
}

/* --------------------------------------------- 插件配置：目录内 + 目录外 */

/** 有些插件把配置放在自己目录以外（家目录 / .config / .dsh 下的数据目录），这里补上要额外看的位置。 */
const PLUGIN_CONFIG_HOMES = {
  '@liustack/modlens': ['.modlens'],
  'billion-context': ['.config/billion-context'],
  'dsh-connect-workbuddy': ['.dsh/workbuddy-vault'],
  'dsh-aurabot-qq': ['.dsh/plugins-data/aurabot'],
  '@xmanrui/dsh-im': ['.dsh/integrations/dsh-im'],
}

/** 这些看着像配置、其实是运行产物，列出来会误导。 */
const CONFIG_NOISE = /(\.bak|backup|-cache|\.log$|\.lock$|\.pid$|\.tmp$|\.map$|\.sqlite|^session|^sessions|^cache|^tmp|^state\.json$|telemetry)/i

/** 一个插件可能放配置的目录：插件自己的目录 + 家目录里常见的落点。 */
function pluginConfigDirs(name) {
  const out = []
  const dir = packageDirOf(name)
  if (dir && !dir.toLowerCase().includes('.asar')) out.push({ dir, where: '插件目录' })
  const short = String(name || '').split('/').pop()
  const home = homeDir()
  const bases = []
  for (const rel of PLUGIN_CONFIG_HOMES[name] || []) bases.push(path.join(home, rel))
  bases.push(path.join(home, '.' + short))
  bases.push(path.join(home, '.config', short))
  bases.push(path.join(dshHome(), short))
  bases.push(path.join(dshHome(), 'plugins-data', short))
  bases.push(path.join(dshHome(), 'integrations', short))
  const seen = new Set()
  for (const base of bases) {
    const key = path.resolve(base).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (!isDir(base)) continue
    if (out.some((one) => path.resolve(one.dir).toLowerCase() === key)) continue
    out.push({ dir: base, where: '数据目录' })
  }
  return out
}

/** 扫一个插件所有可能的配置目录（只第一层），返回可以直接编辑的文件。 */
function pluginConfigFiles(name) {
  const out = []
  const seen = new Set()
  for (const one of pluginConfigDirs(name)) {
    const dir = one.dir
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const file = entry.name
      const lower = file.toLowerCase()
      if (lower === 'package.json' || lower === 'readme.md' || lower === 'skill.md') continue
      if (CONFIG_NOISE.test(lower)) continue
      const looks = CONFIG_EXT.has(path.extname(lower)) || lower.startsWith('.env') || lower.startsWith('config')
      if (!looks) continue
      const abs = path.join(dir, file)
      const key = path.resolve(abs).toLowerCase()
      if (seen.has(key)) continue
      let bytes = 0
      try {
        bytes = fs.statSync(abs).size
      } catch {
        continue
      }
      if (bytes > CONFIG_MAX) continue
      seen.add(key)
      out.push({ name: file, path: abs, bytes, where: one.where })
    }
  }
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return out.slice(0, 24)
}

/** 校验待编辑的插件配置文件（必须落在它自己的某个允许目录里，且只第一层）。 */
function pluginConfigPathAny(name, input) {
  const clean = String((input && (input.path || input.file)) || '').trim()
  if (!clean) throw fail('缺少配置文件', 400)
  const target = path.resolve(clean)
  const allowed = pluginConfigDirs(name).map((one) => path.resolve(one.dir).toLowerCase())
  const parent = path.dirname(target).toLowerCase()
  if (!allowed.includes(parent)) throw fail('这个文件不在允许编辑的目录里', 403)
  if (CONFIG_NOISE.test(path.basename(target).toLowerCase())) throw fail('这个文件不能改', 400)
  if (!isFile(target)) throw fail('这个文件不在了', 404)
  return target
}

/* ------------------------------------------- 插件配置：结构化编辑（模型 / 密钥） */

const MODEL_KEY = /^(model|modelname|defaultmodel|visionmodel|vision_model|llmmodel|chatmodel)$/i
const KEY_KEY = /(apikey|api_key|api-token|token|secret|password|passwd|cookie|sessdata|buvid\d?|bilijct|authorization|credential)$/i
const URL_KEY = /^(baseurl|base_url|baseuri|base_uri|apiurl|api_url|apiendpoint|api_endpoint|endpoint|endpointurl|host|hosturl|serverurl|server_url|proxyurl|proxy_url|modelurl|url|uri)$/i

/** 字段的友好中文名：让人一眼知道这一行该填 key 还是填地址。 */
function fieldLabel(kind, key) {
  const k = String(key).toLowerCase()
  const map = {
    apikey: 'API 密钥', api_key: 'API 密钥', 'api-token': 'API 令牌',
    token: 'Token 令牌', secret: '密钥 Secret', password: '密码', passwd: '密码',
    cookie: 'Cookie', sessdata: 'SESSDATA', bilijct: 'bili_jct', buvid3: 'buvid3', buvid4: 'buvid4',
    webuitoken: 'WebUI Token', webuipassword: 'WebUI 密码', httptoken: 'HTTP Token', wstoken: 'WS Token',
    authorization: 'Authorization', credential: '凭据',
    baseurl: '服务地址', base_url: '服务地址', baseuri: '服务地址', base_uri: '服务地址',
    apiurl: '接口地址', api_url: '接口地址', apiendpoint: '接口地址', api_endpoint: '接口地址',
    endpoint: '接口地址', endpointurl: '接口地址', host: '服务地址', hosturl: '服务地址',
    serverurl: '服务地址', server_url: '服务地址', proxyurl: '代理地址', proxy_url: '代理地址',
    modelurl: '模型地址', url: '地址', uri: '地址',
    model: '模型', modelname: '模型', defaultmodel: '默认模型', visionmodel: '视觉模型', vision_model: '视觉模型',
    llmmodel: '模型', chatmodel: '对话模型',
  }
  if (map[k]) return map[k]
  if (kind === 'model') return '模型'
  if (kind === 'url') return '服务地址'
  return key
}

function dottedGet(obj, dotted) {
  let cur = obj
  for (const part of String(dotted).split('.')) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

function dottedSet(obj, dotted, value) {
  const parts = String(dotted).split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]]
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw fail('这个字段不在配置里：' + dotted, 400)
    cur = next
  }
  const last = parts[parts.length - 1]
  if (!(last in cur)) throw fail('这个字段不在配置里：' + dotted, 400)
  cur[last] = value
}

/** 读一个 .json 配置，解析成对象。 */
function pluginJsonOf(name, input) {
  const file = pluginConfigPathAny(name, input)
  if (path.extname(file).toLowerCase() !== '.json') {
    throw fail('只有 .json 配置能做结构化编辑；其他文件请用下面的文本编辑', 400)
  }
  let json
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw fail('这个 JSON 现在解析不了，先手工修一下：' + ((error && error.message) || error), 400)
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw fail('这个 JSON 不是对象，没法按字段编辑', 400)
  return { file, json }
}

/** 从配置里挑出「模型」「地址」「密钥」这三类字段，外加可以作为新增密钥落点的对象。 */
function scanStructured(json) {
  const models = []
  const urls = []
  const keys = []
  const parents = [{ path: '', label: '（根）' }]
  const visit = (node, prefix, depth) => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 4) return
    if (depth <= 2 && prefix) parents.push({ path: prefix, label: prefix })
    for (const k of Object.keys(node)) {
      const v = node[k]
      const p = prefix ? prefix + '.' + k : k
      if (typeof v === 'string') {
        if (MODEL_KEY.test(k)) {
          const hasProvider = typeof node.provider === 'string'
          models.push({
            path: p,
            label: fieldLabel('model', k),
            key: k,
            value: v,
            providerPath: hasProvider ? (prefix ? prefix + '.provider' : 'provider') : '',
            providerValue: hasProvider ? node.provider : '',
          })
        } else if (URL_KEY.test(k)) {
          urls.push({ path: p, label: fieldLabel('url', k), key: k, value: v })
        } else if (KEY_KEY.test(k)) {
          keys.push({
            path: p,
            label: fieldLabel('key', k),
            key: k,
            set: v.length > 0,
            length: v.length,
            preview: v ? v.slice(0, 3) + '…' + v.slice(-2) : '',
          })
        }
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!KEY_KEY.test(k)) visit(v, p, depth + 1)
      }
    }
  }
  visit(json, '', 0)
  return { models, urls, keys, parents }
}

/* ---- 按「哪个子系统」分组：图像生成 / 语音 / 记忆 …，并判断本地还是云端 ---- */

const SECTION_LABELS = {
  model: '默认聊天模型',
  chatmodels: '聊天模型（按场景）',
  imagegen: '图像生成',
  video: '视频生成',
  voice: '语音 / TTS',
  asrapi: '语音识别',
  stickers: '表情包生成',
  personalook: '形象 / 视觉',
  persona: '人格设定',
  memory: '记忆 / 向量检索',
  bili: 'B 站账号',
  heybox: '小黑盒',
  song: '歌曲 / 网易云',
  backup: '备份（WebDAV）',
  snowluma: 'SnowLuma 桥接',
  bridge: '桥接服务',
  douyin: '抖音',
  qzone: 'QQ 空间',
  gateway: '网关',
  llm: '模型服务',
  providers: '模型服务商',
  chat: '聊天',
  security: '安全',
  browser: '浏览器',
  update: '更新',
  cost: '费用',
  asr: '语音识别',
  tts: '语音合成',
  minimax: 'MiniMax',
  volcano: '火山引擎',
  breeze: 'Breeze',
}

function labelOfSection(seg) {
  const raw = String(seg || '')
  const k = raw.toLowerCase().replace(/[-_\s]/g, '')
  return SECTION_LABELS[k] || raw
}

const LOCAL_HOST = /^(?:(?:https?|wss?):\/\/)?(?:127\.|localhost\b|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i

function localOfUrl(u) {
  const s = String(u || '').trim()
  if (!s) return 'unknown'
  return LOCAL_HOST.test(s) ? 'local' : 'cloud'
}

/** 本地地址大概对应哪个模型目录（能猜到的就给出，猜不到就留空）。 */
function localHint(url) {
  const s = String(url || '')
  if (!s) return { kind: 'none', label: '没填地址', folder: '' }
  if (/11434/.test(s)) return { kind: 'local', label: '本地 · Ollama', folder: path.join(homeDir(), '.ollama', 'models') }
  if (/1234/.test(s)) return { kind: 'local', label: '本地 · LM Studio', folder: path.join(homeDir(), '.lmstudio', 'models') }
  if (/8000/.test(s)) return { kind: 'local', label: '本地 · llama.cpp / vLLM', folder: '' }
  if (localOfUrl(s) === 'local') return { kind: 'local', label: '本地', folder: '' }
  return { kind: 'cloud', label: '云端', folder: '' }
}

const LOGIN_KEY = /^(cookie|sessdata|bili_?jct|buvid\d?|netease_?cookie|csrf|csrf_?token|auth|auth_?data|session|session_?key|webui_?password|webui_?token|http_?token|ws_?token|access_?token|refresh_?token)$/i

const LOCAL_PROVIDER = /^(local|ollama|lmstudio|lm-?studio|vllm|llama\.?cpp|llama|llamacpp|sglang|koboldcpp|xinference|text-generation-webui)$/i
const CLOUD_PROVIDER = /^(openai|azure|azure-openai|anthropic|claude|gemini|google|deepseek|siliconflow|silicon-flow|zhipu|bigmodel|dashscope|qwen|moonshot|kimi|minimax|volcano|volcengine|breeze|agnes|openrouter|groq|mistral|together|fireworks|xai|cohere|baidu|qianfan|hunuit|nong)$/i

/** 值为空 / default / inherit / deepseek 这类，表示「跟随 DSH 的默认模型」。 */
const INHERIT_VALUE = /^(|default|inherit|inherit-dsh|follow|follow-?deepseek|deepseek|auto|none|same|ds)$/i

function localOfProvider(p) {
  const s = String(p || '').trim()
  return s && LOCAL_PROVIDER.test(s) ? 'local' : ''
}

/** 本地 provider 大概把模型权重放在哪。 */
function folderOfProvider(p) {
  const s = String(p || '').toLowerCase()
  if (/ollama/.test(s)) return path.join(homeDir(), '.ollama', 'models')
  if (/lm-?studio/.test(s)) return path.join(homeDir(), '.lmstudio', 'models')
  return ''
}

/** 登录态字段的中文名（Cookie / SESSDATA 这类不是 API key，是要登录后才有的凭据）。 */
function loginLabel(k) {
  const s = String(k).toLowerCase()
  if (s === 'cookie') return '登录态 Cookie'
  if (/netease_?cookie/.test(s)) return '网易云登录 Cookie'
  if (s === 'sessdata') return '登录态 SESSDATA'
  if (/bili_?jct/.test(s)) return '登录态 bili_jct（CSRF）'
  if (/^buvid/.test(s)) return '设备 ID（buvid）'
  if (/csrf/.test(s)) return 'CSRF Token'
  if (/webui_?password/.test(s)) return 'WebUI 密码'
  if (/webui_?token/.test(s)) return 'WebUI Token'
  if (/^(http|ws)_?token$/.test(s)) return '桥接 Token'
  if (/session/.test(s)) return '登录会话'
  if (/auth/.test(s)) return '登录凭据'
  return '登录态'
}

/** 这类账号去哪登录（给客户端一个「打开登录页」按钮）。 */
function loginUrlOf(sectionLabel, pathText) {
  const s = (String(sectionLabel || '') + ' ' + String(pathText || '')).toLowerCase()
  if (/bili|b站/.test(s)) return 'https://passport.bilibili.com/login'
  if (/song|网易云|netease/.test(s)) return 'https://music.163.com'
  if (/heybox|小黑盒/.test(s)) return 'https://www.xiaoheihe.cn'
  if (/douyin|抖音/.test(s)) return 'https://www.douyin.com'
  return ''
}

/** 把配置按子系统切成若干组，每组自带「模型 / 地址 / 密钥」三类字段。 */
function scanSections(json) {
  const sections = []
  const seen = new Set()
  let envMap = {}
  try {
    envMap = envFileMap()
  } catch {
    envMap = {}
  }
  const collect = (node, prefix) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const fields = []
    let baseUrl = ''
    let providerValue = ''
    for (const k of Object.keys(node)) {
      const v = node[k]
      const p = prefix ? prefix + '.' + k : k
      if (k === 'provider' && typeof v === 'string') providerValue = v
      if (typeof v !== 'string') continue
      if (k === 'provider') {
        fields.push({ kind: 'provider', path: p, key: k, label: 'provider', value: v })
        continue
      }
      if (MODEL_KEY.test(k)) {
        const hasProvider = typeof node.provider === 'string'
        fields.push({
          kind: 'model',
          path: p,
          key: k,
          label: fieldLabel('model', k),
          value: v,
          providerPath: hasProvider ? (prefix ? prefix + '.provider' : 'provider') : '',
          providerValue: hasProvider ? node.provider : '',
        })
      } else if (URL_KEY.test(k)) {
        if (!baseUrl) baseUrl = v
        fields.push({ kind: 'url', path: p, key: k, label: fieldLabel('url', k), value: v })
      } else if (/^apiKeyEnv$/i.test(k)) {
        fields.push({
          kind: 'envkey',
          path: p,
          key: k,
          label: 'API 密钥（环境变量）',
          envName: v,
          set: !!(envMap[v] || process.env[v]),
        })
      } else if (LOGIN_KEY.test(k)) {
        fields.push({
          kind: 'login',
          path: p,
          key: k,
          label: loginLabel(k),
          set: v.length > 0,
          length: v.length,
          preview: v ? v.slice(0, 4) + '…' + v.slice(-3) : '',
        })
      } else if (KEY_KEY.test(k)) {
        fields.push({
          kind: 'key',
          path: p,
          key: k,
          label: fieldLabel('key', k),
          set: v.length > 0,
          length: v.length,
          preview: v ? v.slice(0, 3) + '…' + v.slice(-2) : '',
        })
      }
    }
    const key = prefix || '__root__'
    if (fields.length && !seen.has(key)) {
      seen.add(key)
      const modelField = fields.find((f) => f.kind === 'model')
      const modelEmpty = !!modelField && !String(modelField.value || '').trim()
      const inherit = modelEmpty && INHERIT_VALUE.test(String(providerValue || ''))
      let hint = localHint(baseUrl)
      if (inherit) hint = { kind: 'inherit', label: '跟随 DSH 默认模型', folder: '' }
      else if (!baseUrl && localOfProvider(providerValue) === 'local') {
        const pv = String(providerValue || '')
        hint = { kind: 'local', label: '本地' + (/^(local|本机)$/i.test(pv) ? '' : ' · ' + pv), folder: folderOfProvider(pv) }
      } else if (!baseUrl && CLOUD_PROVIDER.test(String(providerValue || ''))) {
        hint = { kind: 'cloud', label: '云端 · ' + String(providerValue), folder: '' }
      }
      const onlyLogin = fields.length > 0 && fields.every((f) => f.kind === 'login')
      if (onlyLogin && !inherit) hint = { kind: 'login', label: '需要登录', folder: '' }
      const folder = hint.folder && isDir(hint.folder) ? hint.folder : ''
      const secLabel = prefix ? labelOfSection(prefix.split('.').pop()) : '（根）'
      sections.push({
        path: prefix || '',
        label: secLabel,
        where: prefix || '（根）',
        local: hint.kind,
        localLabel: hint.label,
        localFolder: folder,
        baseUrl,
        provider: providerValue,
        disabled: node.enabled === false,
        inherit,
        loginUrl: fields.some((f) => f.kind === 'login') ? loginUrlOf(secLabel, prefix) : '',
        fields,
      })
    }
    const depth = prefix ? prefix.split('.').length : 0
    if (depth >= 3) return
    for (const k of Object.keys(node)) {
      const v = node[k]
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      if (KEY_KEY.test(k)) continue
      collect(v, prefix ? prefix + '.' + k : k)
    }
  }
  collect(json, '')
  return sections
}

/** DSH 里配置过的模型 id（settings.yaml 里各 provider 的 models 列表）。 */
function dshModelOptions() {
  const out = []
  let text = ''
  try {
    text = fs.readFileSync(path.join(dshHome(), 'settings.yaml'), 'utf8')
  } catch {
    return out
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*-\s+id:\s*['"]?([^\s'"]+)['"]?/.exec(line)
    if (m) out.push(m[1])
  }
  out.push('auto')
  return Array.from(new Set(out)).slice(0, 80)
}

/** 一个 JSON 配置的结构化视图：模型下拉候选、地址、密钥清单、可用父对象。 */
/** 本地模型那几组，如果配置里没写地址、但插件目录/数据目录下有模型文件夹，就把文件夹补上。 */
function enrichLocalFolders(sections, dirs) {
  const list = Array.isArray(dirs) ? dirs : []
  for (const s of sections) {
    if (s.local !== 'local' || s.localFolder) continue
    for (const d of list) {
      const base = d && d.dir
      if (!base) continue
      for (const sub of ['local', 'models', 'model', 'weights', 'checkpoints', 'gguf', 'MODELS']) {
        const c = path.join(base, sub)
        if (isDir(c) && safeReaddir(c).some((f) => MODEL_FILE_RE.test(f))) { s.localFolder = c; break }
      }
      if (s.localFolder) break
    }
  }
  return sections
}

const LOCAL_MODEL_CACHE = { at: 0, list: [] }
const MODEL_FILE_RE = /\.(gguf|safetensors|bin|onnx|pth|ckpt|pt|index)$/i
const LOCAL_WORD_SKIP = /^(model|models|local|api|url|key|base|provider|voice|image|video|music|tts|asr|enabled|custom|remote|http|https)$/i

function safeReaddir(dir) {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function dirBytesSmall(dir, limit = 300) {
  let total = 0, n = 0
  try {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (n++ > limit) break
      if (!ent.isFile()) continue
      try { total += fs.statSync(path.join(dir, ent.name)).size } catch {}
    }
  } catch {}
  return total
}

function topModelFiles(dir, limit = 4) {
  const out = []
  for (const name of safeReaddir(dir)) if (MODEL_FILE_RE.test(name)) out.push(name)
  return out.slice(0, limit)
}

/** 本机上真正下载好的模型目录（Aurabot 那一套 breeze-tts2 / rvc 等）。 */
function purposeOfModel(key, files) {
  const k = String(key || '').toLowerCase()
  const f = (files || []).join(' ').toLowerCase()
  if (/separator|roformer|uvr|demucs/.test(k + ' ' + f)) return '人声 / 伴奏分离：翻唱前先把原曲拆成人声和伴奏'
  if (/^rvc|rvc/.test(k) || /\.pth\b/.test(f) || /\.index\b/.test(f)) return 'RVC 音色转换：翻唱 / 变声时把歌声换成这套音色'
  if (/tts|cosyvoice|gptsovits|breeze/.test(k)) return '本地语音合成（TTS）：把文字读成人声'
  if (/whisper|asr|sensevoice|paraformer/.test(k + ' ' + f)) return '语音识别（ASR）：把说话转成文字'
  if (/birefnet|rembg|sam|matting/.test(k)) return '抠图 / 去背景'
  if (/e5|embed|bge|rerank|vector/.test(k)) return '文本向量化 / 重排：给记忆与检索用'
  if (/sd|flux|diffus/.test(k)) return '图像生成 / 风格化出图'
  if (/\.gguf\b/.test(f)) return '本地推理权重（GGUF 量化模型）'
  if (/\.onnx\b/.test(f)) return '本地推理模型（ONNX）'
  if (/\.safetensors\b/.test(f)) return '大模型权重（safetensors）'
  return '模型权重（具体用途看它所在的插件）'
}

function scanLocalModelDirs() {
  const now = Date.now()
  if (now - LOCAL_MODEL_CACHE.at < 60000) return LOCAL_MODEL_CACHE.list
  const roots = []
  for (const r of [process.env.AURABOT_HOME, process.env.AURABOT_ROOT, 'C:\\Aurabot', 'D:\\Aurabot', path.join(homeDir(), 'Aurabot')]) {
    if (!r) continue
    const abs = path.resolve(r)
    if (isDir(abs) && !roots.includes(abs)) roots.push(abs)
  }
  const list = []
  for (const root of roots) {
    for (const name of safeReaddir(root)) {
      const dir = path.join(root, name)
      if (!isDir(dir)) continue
      const cands = []
      for (const sub of ['models', 'model', 'weights', 'checkpoints']) cands.push({ key: name, md: path.join(dir, sub) })
      for (const sub of safeReaddir(dir)) {
        if (!isDir(path.join(dir, sub))) continue
        if (/(^|[-_])(models?|weights|checkpoints)$/i.test(sub) && !cands.some((c) => c.md === path.join(dir, sub))) {
          const tag = sub.replace(/^[-_]?/, '')
          cands.push({ key: name + ':' + tag, md: path.join(dir, sub) })
        }
      }
      let port = 0
      for (const f of safeReaddir(dir)) {
        if (!/\.json$/i.test(f)) continue
        try {
          const p = path.join(dir, f)
          if (fs.statSync(p).size > 20000) continue
          const j = JSON.parse(fs.readFileSync(p, 'utf8'))
          if (j && typeof j.port === 'number') { port = j.port; break }
        } catch {}
      }
      for (const c of cands) {
        if (!isDir(c.md)) continue
        const files = topModelFiles(c.md)
        if (!files.length) continue
        list.push({ key: c.key, root, dir, modelsDir: c.md, bytes: dirBytesSmall(c.md), port, files, use: purposeOfModel(c.key, files) })
      }
    }
  }
  LOCAL_MODEL_CACHE.at = now
  LOCAL_MODEL_CACHE.list = list
  return list
}

function matchLocalModels(sec, list) {
  const words = new Set()
  const push = (v) => {
    const s = String(v || '').toLowerCase()
    for (const w of s.split(/[^a-z0-9]+/)) if (w.length >= 3 && !LOCAL_WORD_SKIP.test(w)) words.add(w)
  }
  push(sec.provider)
  push(sec.where)
  push(sec.label)
  const ws = Array.from(words)
  const hits = []
  for (const it of list) {
    const k = it.key.toLowerCase()
    const kt = k.split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
    let hit = ws.some((w) => k.includes(w))
    if (!hit) hit = ws.some((w) => kt.some((t) => t.length >= 3 && (w.includes(t) || t.includes(w))))
    if (hit && !hits.includes(it)) hits.push(it)
  }
  return hits
}

function attachLocalModels(sections) {
  const locals = scanLocalModelDirs()
  const out = sections.map((s) => {
    const hits = matchLocalModels(s, locals)
    const next = Object.assign({}, s, { localModels: hits.map((h) => ({ key: h.key, dir: h.dir, modelsDir: h.modelsDir, bytes: h.bytes, port: h.port, files: h.files })) })
    if (hits.length && s.local !== 'inherit' && s.local !== 'login' && s.local !== 'local') {
      const first = hits[0]
      next.local = 'local'
      next.localLabel = '本地 · ' + first.key + (first.port ? ' :' + first.port : '')
      next.localFolder = first.modelsDir
      if (s.local === 'cloud') next.localNote = '配置里写的是 ' + (s.baseUrl || s.provider) + '，但本机有 ' + first.key + ' 模型' + (first.port ? '（端口 ' + first.port + '）' : '')
    }
    const localUrl = /^(?:https?:\/\/)?(?:127\.|localhost|0\.0\.0\.0|\[::1\])/i.test(String(s.baseUrl || ''))
    if (!hits.length && localUrl) next.localFolder = ''
    return next
  })
  return { sections: out, locals }
}

/** 常见设置项的中文名。查不到就原样显示。 */
const MISC_LABELS = {
  enabled: '启用', dryRun: '试运行（不真发）', debug: '调试模式', setupDone: '已完成初始化',
  botqq: '机器人 QQ', ownerqq: '主人 QQ', ownername: '主人名字', ownerlevel: '主人权限级别',
  approvalnotify: '审批通知方式', notice: '公告', qqapi: 'QQ 接口地址', approvalviaqq: '在 QQ 里审批',
  approvaltimeoutsec: '审批超时（秒）', profileperms: '资料权限', capabilityallow: '允许的能力',
  commandallow: '允许的命令', longtasks: '长任务', subagentbackground: '后台子代理',
  allow: '允许名单', gateway: '网关', workspaceDir: '工作目录', workspaceDir_l: '工作目录',
  files: '文件设置', security: '安全', browser: '浏览器', cost: '费用', update: '更新',
  persona: '人格设定', personaLook: '形象', group: '群聊', memberfilter: '成员过滤',
  titlefilter: '头衔过滤', voice: '语音', stickers: '表情包', diary: '日记', local: '本地',
  bili: 'B 站账号', douyin: '抖音', heybox: '小黑盒', qzonesocial: 'QQ 空间', speakup: '主动发言',
  mood: '情绪', chat: '聊天', conversationcontext: '上下文', memory: '记忆', song: '点歌',
  backup: '备份', tabs: '标签页', modules: '模块', safemode: '安全模式', ext: '扩展',
  usage: '用量', bridge: '桥接', ownerauthorization: '主人授权', communitymigrated: '社区迁移状态',
  vision: '视觉', reasoningeffort: '推理强度', port: '端口', mode: '模式', url: '地址',
  spkid: '音色 ID', siteurl: '站点地址', region: '地区', regions: '地区',
  showcreditsinmainui: '在主界面显示额度', lastcatalog: '最近的模型目录', transcriptview: '对话记录视图',
  performanceusage: '性能用量', welcomenoticeversion: '欢迎提示版本', statedir: '状态目录',
  targetlanguage: '目标语言', modelname: '模型名', apikeyenv: 'API 密钥（环境变量）',
  privedefault: '私聊默认', groupdefault: '群聊默认', privates: '私聊', groups: '群聊',
  reasoning: '推理', cot: '思维链', retry: '重试', timeout: '超时', maxtokens: '最大 token',
  contextwindow: '上下文长度', temperature: '温度', stream: '流式输出',
  approval: '审批方式', question: '提问方式', notify: '通知方式', whitelist: '白名单',
  blacklist: '黑名单', masters: '主人列表', admins: '管理员', prefix: '命令前缀',
  autoreply: '自动回复', ratelimit: '限流', maxlength: '最大长度', lang: '语言',
}

function miscLabel(key) {
  const k = String(key || '')
  const lower = k.toLowerCase().replace(/[-_\s]/g, '')
  return MISC_LABELS[lower] || MISC_LABELS[k] || k
}

/** 非模型 / 地址 / 密钥的其它可改字段：布尔、数字、短文本（最多 60 个）。 */
function scanMisc(json) {
  const out = []
  const skip = (k) => MODEL_KEY.test(k) || KEY_KEY.test(k) || URL_KEY.test(k) || LOGIN_KEY.test(k) || /^apiKeyEnv$/i.test(k) || /^provider$/i.test(k)
  const walk = (node, prefix, depth) => {
    if (out.length >= 60 || !node || typeof node !== 'object' || Array.isArray(node)) return
    for (const k of Object.keys(node)) {
      if (k.startsWith('_')) continue
      const v = node[k]
      const p = prefix ? prefix + '.' + k : k
      if (/^communityMigrated\./i.test(p)) continue
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (depth < 1) walk(v, p, depth + 1)
        continue
      }
      if (Array.isArray(v) || skip(k)) continue
      if (typeof v === 'boolean') out.push({ path: p, key: k, label: miscLabel(k), kind: 'bool', value: v })
      else if (typeof v === 'number') out.push({ path: p, key: k, label: miscLabel(k), kind: 'number', value: v })
      else if (typeof v === 'string' && v.length <= 200 && !/\n/.test(v)) out.push({ path: p, key: k, label: miscLabel(k), kind: 'text', value: v })
    }
  }
  walk(json, '', 0)
  return out
}

/** 只把「属于这个插件」的本机模型捡出来，别把别的插件的模型挂进来。 */
function localsForPlugin(name, list) {
  const short = String(name || '').split('/').pop().toLowerCase().replace(/^dsh-/, '')
  const words = short.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && w !== 'local' && w !== 'skill' && w !== 'center')
  if (!words.length) return []
  return (list || []).filter((it) => {
    const hay = (String(it.dir || '') + ' ' + String(it.modelsDir || '') + ' ' + String(it.key || '')).toLowerCase()
    return words.some((w) => hay.includes(w))
  })
}

function pluginStructure(name, input) {
  if (input && input.source === 'profile') return pluginStructureProfile(name)
  const { file, json } = pluginJsonOf(name, input)
  const { models, urls, keys, parents } = scanStructured(json)
  const providerSet = new Set(['openai', 'anthropic', 'gemini', 'deepseek', 'magpie', 'local', 'custom', 'ollama'])
  for (const one of models) if (one.providerValue) providerSet.add(one.providerValue)
  const prof = profileConfigFor(name)
  const attached = attachLocalModels(enrichLocalFolders(scanSections(json), pluginConfigDirs(name)))
  return {
    structure: {
      file,
      name: path.basename(file),
      configDir: path.dirname(file),
      dirs: pluginConfigDirs(name),
      installDir: packageDirOf(name) || '',
      models,
      urls,
      keys,
      parents,
      sections: attached.sections,
      locals: localsForPlugin(name, attached.locals),
      misc: scanMisc(json),
      modelOptions: dshModelOptions(),
      providerOptions: Array.from(providerSet),
      profile: prof ? { id: prof.id, name: prof.name, file: profilePatchPath() } : null,
    },
  }
}

/** profile 的 cordis.patch.yml 里，这个插件自己的 config 块。 */
function pluginStructureProfile(name) {
  const prof = profileConfigFor(name)
  if (!prof) throw fail('这个插件在 profile 的 cordis.patch.yml 里没有配置块', 404)
  const { parents } = scanStructured(prof.config)
  return {
    structure: {
      file: profilePatchPath(),
      name: 'cordis.patch.yml · ' + (prof.id || prof.name),
      configDir: profileDir(),
      dirs: [{ dir: profileDir(), where: 'profile 目录' }],
      installDir: packageDirOf(name) || '',
      models: [],
      urls: [],
      keys: [],
      parents,
      sections: attachLocalModels(enrichLocalFolders(scanSections(prof.config), [{ dir: profileDir(), where: 'profile' }])).sections,
      locals: localsForPlugin(name, scanLocalModelDirs()),
      misc: scanMisc(prof.config),
      modelOptions: dshModelOptions(),
      providerOptions: ['openai', 'anthropic', 'gemini', 'deepseek', 'magpie', 'local', 'custom', 'ollama'],
      profile: { id: prof.id, name: prof.name, file: profilePatchPath() },
    },
  }
}

/** 打开一个插件「存配置/模型的地方」：优先给定路径的目录，其次配置文件目录，再次数据目录。 */
function openPluginDir(name, input) {
  let dir = ''
  const want = input && input.path ? String(input.path) : ''
  if (want) {
    dir = isDir(want) ? want : path.dirname(want)
  }
  if (!dir || !isDir(dir)) {
    const files = pluginConfigFiles(name)
    if (files.length) dir = path.dirname(files[0].path)
  }
  if (!dir || !isDir(dir)) {
    dir = pluginConfigDirs(name).find((one) => isDir(one)) || ''
  }
  if (!dir || !isDir(dir)) dir = packageDirOf(name) || ''
  if (!dir || !isDir(dir)) throw fail('找不到这个插件的目录', 404)
  try {
    const child = spawn(IS_WIN ? 'explorer.exe' : 'xdg-open', [dir], { detached: true, stdio: 'ignore' })
    child.unref()
  } catch (error) {
    throw fail('打不开目录：' + ((error && error.message) || error), 500)
  }
  return { message: '已打开 ' + dir }
}

/** 按原来的类型落值：原来是布尔/数字就别写成字符串。 */
function coerceValue(existing, value) {
  if (typeof existing === 'boolean') return String(value) === 'true' || String(value) === '1'
  if (typeof existing === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }
  return value
}

/** 写一个结构化字段（模型名 / provider / 密钥值）。 */
function setPluginField(name, input) {
  const { file, json } = pluginJsonOf(name, { path: input.path })
  const field = String(input.field || '').trim()
  if (!field) throw fail('缺少字段名', 400)
  const raw = String(input.value == null ? '' : input.value)
  if (raw.length > 8192) throw fail('这个值太长了', 400)
  const value = coerceValue(dottedGet(json, field), raw)
  dottedSet(json, field, value)
  writeJsonBackup(file, json)
  return { message: '已保存 ' + path.basename(file) + '：' + field, ...pluginStructure(name, { path: file }) }
}

/** 往某个对象里新增一条（比如加一个新的 apiKey / token）。 */
function addPluginField(name, input) {
  const { file, json } = pluginJsonOf(name, { path: input.path })
  const parent = String(input.parent || '').trim()
  const key = String(input.key || '').trim()
  if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,60}$/.test(key)) throw fail('字段名只能字母、数字、下划线、点和短横', 400)
  const target = parent ? dottedGet(json, parent) : json
  if (!target || typeof target !== 'object' || Array.isArray(target)) throw fail('找不到要加进去的那一层：' + (parent || '（根）'), 400)
  if (key in target) throw fail('这个字段已经有了：' + key, 400)
  target[key] = String(input.value == null ? '' : input.value)
  writeJsonBackup(file, json)
  return { message: '已添加 ' + key + ' 到 ' + path.basename(file), ...pluginStructure(name, { path: file }) }
}

/** 删掉一个字段（主要用于清掉不再用的密钥）。 */
function removePluginField(name, input) {
  const { file, json } = pluginJsonOf(name, { path: input.path })
  const field = String(input.field || '').trim()
  const parts = field.split('.')
  if (parts.length < 2) throw fail('顶层字段不能删，只能清空', 400)
  const parentObj = dottedGet(json, parts.slice(0, -1).join('.'))
  const last = parts[parts.length - 1]
  if (!parentObj || typeof parentObj !== 'object' || !(last in parentObj)) throw fail('这个字段不在配置里：' + field, 400)
  delete parentObj[last]
  writeJsonBackup(file, json)
  return { message: '已删除 ' + field, ...pluginStructure(name, { path: file }) }
}

function writeJsonBackup(file, json) {
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak-skill-center')
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
}

/** 打开一个配置所在的文件夹（只允许打开插件自己的配置目录）。 */
function openPluginData(name, input) {
  const file = pluginConfigPathAny(name, { path: input.path })
  const dir = path.dirname(file)
  try {
    const child = spawn(IS_WIN ? 'explorer.exe' : 'xdg-open', [dir], { detached: true, stdio: 'ignore' })
    child.unref()
  } catch (error) {
    throw fail('打不开目录：' + ((error && error.message) || error), 500)
  }
  return { message: '已打开 ' + dir }
}

/* ---- profile 的 cordis.patch.yml：多数插件的真正用户配置在这里 ---- */

function profilePatchPath() {
  return path.join(profileDir(), 'cordis.patch.yml')
}

let YAML_LIB = null
function yamlLib() {
  if (YAML_LIB) return YAML_LIB
  for (const candidate of [
    path.join(profileDir(), 'node_modules', 'js-yaml'),
    path.join(dshHome(), 'profiles', 'desktop', 'node_modules', 'js-yaml'),
    path.join(homeDir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'js-yaml'),
    'js-yaml',
  ]) {
    try {
      const lib = CJS_REQUIRE(candidate)
      if (lib && typeof lib.load === 'function') {
        YAML_LIB = lib
        return lib
      }
    } catch {
      /* 换下一个 */
    }
  }
  throw fail('读不了 YAML（找不到 js-yaml），这个配置文件请用文本编辑', 500)
}

function profileDoc() {
  const file = profilePatchPath()
  if (!isFile(file)) return { file, text: '', doc: [] }
  const text = fs.readFileSync(file, 'utf8')
  let doc
  try {
    doc = yamlLib().load(text)
  } catch (error) {
    throw fail('profile 的 cordis.patch.yml 现在解析不了：' + ((error && error.message) || error), 500)
  }
  return { file, text, doc: Array.isArray(doc) ? doc : [] }
}

/** name 对应的 config 块（先按 name 全等，再按短名匹配 id）。 */
function profileConfigFor(name) {
  let doc
  try {
    doc = profileDoc().doc
  } catch {
    return null
  }
  const hasConfig = (e) => e && typeof e === 'object' && e.config && typeof e.config === 'object' && !Array.isArray(e.config)
  const short = String(name || '').split('/').pop()
  let hit = doc.find((e) => hasConfig(e) && String(e.name || '') === name)
  if (!hit) hit = doc.find((e) => hasConfig(e) && String(e.id || '') === short)
  if (!hit) hit = doc.find((e) => hasConfig(e) && String(e.name || '').split('/').pop() === short)
  if (!hit) return null
  return { id: String(hit.id || ''), name: String(hit.name || ''), config: hit.config }
}

/** 用新的 config 对象替换文本里那个 entry 的 config: 块（其余内容一字不动）。 */
function replaceConfigBlock(lines, entryId, configObj) {
  const dump = yamlLib().dump(configObj, { indent: 2, lineWidth: 200, noRefs: true, sortKeys: false })
  const body = String(dump).replace(/\n$/, '').split('\n')
  let start = -1
  let entryIndent = 0
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)-\s*id:\s*['"]?([^'"\s]+)['"]?\s*(?:#.*)?$/.exec(lines[i])
    if (m && m[2] === entryId) {
      start = i
      entryIndent = m[1].length
      break
    }
  }
  if (start < 0) throw fail('在文件里找不到这个配置块：' + entryId, 404)
  let configLine = -1
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const indent = line.length - line.trimStart().length
    if (/^\s*-\s*(id|insert):/.test(line) && indent <= entryIndent) break
    if (/^\s*config:\s*(?:#.*)?$/.test(line) && indent > entryIndent) {
      configLine = i
      break
    }
  }
  if (configLine < 0) throw fail('这个配置块里没有 config:，先手动加一个再来', 400)
  const configIndent = lines[configLine].length - lines[configLine].trimStart().length
  let end = lines.length
  for (let i = configLine + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const indent = line.length - line.trimStart().length
    if (indent <= configIndent) {
      end = i
      break
    }
  }
  const pad = ' '.repeat(configIndent + 2)
  const block = [' '.repeat(configIndent) + 'config:']
  for (const line of body) block.push(line ? pad + line : '')
  return [...lines.slice(0, configLine), ...block, ...lines.slice(end)]
}

/** 改 profile cordis.patch.yml 里某个配置块的一个字段（写前备份、写后校验，失败还原）。 */
function setProfileField(name, input) {
  const field = String((input && input.field) || '').trim()
  if (!field) throw fail('缺少字段名', 400)
  const value = String(input.value == null ? '' : input.value)
  if (value.length > 8192) throw fail('这个值太长了', 400)
  const prof = profileConfigFor(name)
  if (!prof) throw fail('这个插件在 profile 的 cordis.patch.yml 里没有配置块', 404)
  const { file, text, doc } = profileDoc()
  const entry = doc.find((e) => String(e.id || '') === prof.id)
  if (!entry || !entry.config) throw fail('找不到这个配置块：' + prof.id, 404)
  const target = JSON.parse(JSON.stringify(entry.config))
  dottedSet(target, field, coerceValue(dottedGet(target, field), value))
  const nextText = replaceConfigBlock(text.split(/\r?\n/), prof.id, target).join('\n')
  fs.copyFileSync(file, file + '.bak-skill-center')
  fs.writeFileSync(file, nextText, 'utf8')
  let after
  try {
    after = yamlLib().load(nextText)
  } catch (error) {
    fs.copyFileSync(file + '.bak-skill-center', file)
    throw fail('写回去之后 YAML 解析失败，已还原原文件：' + ((error && error.message) || error), 500)
  }
  const afterEntry = (Array.isArray(after) ? after : []).find((e) => String(e.id || '') === prof.id)
  if (!afterEntry || JSON.stringify(afterEntry.config) !== JSON.stringify(target)) {
    fs.copyFileSync(file + '.bak-skill-center', file)
    throw fail('写回去校验不一致，已还原原文件（这个 config 块里可能有注释或锚点，请用文本编辑）', 500)
  }
  return { message: '已保存 ' + path.basename(file) + '：' + field + '（重启 DSH 后生效）', ...pluginStructureProfile(name) }
}

/** 把 key 写进 DSH 自己的 ~/.dsh/.env（就是 apiKeyEnv 指向的那个变量）。 */
function writeDshEnvVar(input) {
  const key = String((input && input.env) || '').trim()
  const value = String(input && input.value != null ? input.value : '')
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) throw fail('变量名只能是大写字母、数字、下划线', 400)
  if (/[\r\n]/.test(value)) throw fail('值里不能换行', 400)
  if (value.length > 4096) throw fail('值太长了', 400)
  const file = dshEnvPath()
  let lines = []
  try {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  } catch {
    lines = []
  }
  const idx = lines.findIndex((line) => new RegExp('^\\s*' + key + '\\s*=').test(line))
  if (value === '') {
    if (idx >= 0) lines.splice(idx, 1)
  } else if (idx >= 0) {
    lines[idx] = key + '=' + value
  } else {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.push(key + '=' + value)
  }
  if (isFile(file)) fs.copyFileSync(file, file + '.bak-skill-center')
  fs.writeFileSync(file, lines.join('\n').replace(/\n+$/, '') + '\n', 'utf8')
  return { message: (value === '' ? '已从 .env 删掉 ' : '已写入 .env：') + key + '（重启 DSH 后生效）', model: null }
}

/** DSH 自己当前用的模型：agent-default-model 的 provider/model + llm-pi-ai 里的 provider 列表。 */
function hostModelInfo(doc) {
  const info = { provider: '', model: '', providers: [], file: profilePatchPath() }
  const list = Array.isArray(doc) ? doc : []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object' || !entry.config || typeof entry.config !== 'object') continue
    const id = String(entry.id || '')
    if (id === 'agent-default-model') {
      if (entry.config.provider) info.provider = String(entry.config.provider)
      if (entry.config.model) info.model = String(entry.config.model)
    }
    if (id === 'llm-pi-ai' && entry.config.providers && typeof entry.config.providers === 'object') {
      info.providers = Object.keys(entry.config.providers)
    }
  }
  return info
}

/** 全部插件（含内置 bundle），每次现算，不做落盘缓存 —— 新装的插件下次刷新就在。 */
async function pluginModel() {
  if (!PM || typeof PM.listBundles !== 'function') {
    throw fail('没有拿到 DSH 的插件管理服务（pluginManager），读不到插件清单', 500)
  }
  let list
  try {
    list = await PM.listBundles()
  } catch (error) {
    throw fail('读插件清单失败：' + ((error && error.message) || error), 500)
  }
  const st = loadState()
  let profDoc = []
  try {
    profDoc = profileDoc().doc
  } catch {
    profDoc = []
  }
  const hasCfg = (e) => e && typeof e === 'object' && e.config && typeof e.config === 'object' && !Array.isArray(e.config)
  const profIdOf = (name) => {
    const short = String(name || '').split('/').pop()
    let hit = profDoc.find((e) => hasCfg(e) && String(e.name || '') === name)
    if (!hit) hit = profDoc.find((e) => hasCfg(e) && String(e.id || '') === short)
    if (!hit) hit = profDoc.find((e) => hasCfg(e) && String(e.name || '').split('/').pop() === short)
    return hit ? String(hit.id || '') : ''
  }
  const out = []
  const host = hostModelInfo(profDoc)
  for (const item of Array.isArray(list) ? list : []) {
    const name = String(item.name || '')
    if (!name) continue
    const dir = packageDirOf(name)
    const profileOne = item.availability === 'profile'
    const own = st.pluginSummaries[name]
    const ownName = st.pluginNames && st.pluginNames[name]
    const customName = ownName && typeof ownName.text === 'string' && ownName.text.trim() ? ownName.text.trim() : ''
    const rawDescription = localizedText((item.meta && item.meta.description) || item.description || '')
    const zhDescription = PLUGIN_ZH[name] || ''
    const cfgs = pluginConfigFiles(name)
    const profileId = profIdOf(name)
    out.push({
      name,
      displayName: customName || name,
      nameSource: customName ? 'user' : 'original',
      hostModel: host,
      usesHostModel: !profileId && cfgs.length === 0,
      version: localizedText(item.version),
      description: rawDescription,
      summary: own && own.text ? own.text : (zhDescription || rawDescription),
      summarySource: own && own.text ? 'user' : zhDescription ? 'zh' : 'raw',
      availability: item.availability || '',
      enabled: item.enabled !== false,
      installed: !!item.installed,
      official: !!item.official,
      removable: item.removable !== false,
      optional: !!item.optional,
      source: localizedText(item.source),
      rows: Array.isArray(item.rows)
        ? item.rows.map((row) => ({ rowId: row.rowId || '', moduleName: row.moduleName || '', entryId: row.entryId || '' }))
        : [],
      overrides: Array.isArray(item.overrides) ? item.overrides.slice() : [],
      dir: dir || '',
      editable: !!dir && !dir.toLowerCase().includes('.asar'),
      hasConfigCard: profileOne ? hasConfigCard(dir) : null,
      configs: cfgs,
      profileConfigId: profileId,
      self: name === SELF,
    })
  }
  const weight = (one) => (one.availability === 'profile' ? 0 : one.availability === 'missing' ? 2 : 1)
  out.sort((a, b) => {
    const diff = weight(a) - weight(b)
    if (diff !== 0) return diff
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
  return out
}

/** 插件目录里的一个配置文件（防目录穿越）。 */
function pluginConfigPath(name, file) {
  const dir = packageDirOf(name)
  if (!dir) throw fail('找不到这个插件的安装目录', 404)
  if (dir.toLowerCase().includes('.asar')) throw fail('这个插件是随 DSH 安装的（只读），改不了它的文件', 400)
  const clean = String(file || '').trim()
  if (!clean || clean.includes('/') || clean.includes('\\') || clean.includes('..') || clean === '.') {
    throw fail('配置文件名不合法', 400)
  }
  const target = path.resolve(dir, clean)
  if (path.dirname(target) !== path.resolve(dir)) throw fail('配置文件名不合法', 400)
  if (!isFile(target)) throw fail('这个文件不在了', 404)
  return target
}

/* --------------------------------------------------------------------- apply */

let CFG = {}

function jsonResponse(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function errorResponse(error) {
  const status = (error && error.status) || 500
  return jsonResponse({ ok: false, error: { code: String(status), message: String((error && error.message) || error) } }, status)
}

export function apply(ctx, config = {}) {
  CFG = config && typeof config === 'object' ? config : {}

  try {
    if (ctx.pluginManager) PM = ctx.pluginManager
    else if (typeof ctx.get === 'function') PM = ctx.get('pluginManager') || null
  } catch {
    /* 直取不到就等下面的 inject */
  }

  try {
    ctx.inject(['pluginManager'], (scope) => {
      PM = scope.get('pluginManager') || PM || null
    })
  } catch {
    /* 拿不到就保持原值，页面会显示明确的错误条 */
  }

  const disposeInject = ctx.inject(['connection'], (scope) => {
    const conn = scope.get('connection')
    if (!conn || typeof conn.fetch?.register !== 'function') return undefined

    const stateRoute = conn.fetch.register({
      path: '/api/skill-center/state',
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: async () => {
        try {
          return jsonResponse(buildModel(CFG))
        } catch (error) {
          return errorResponse(error)
        }
      },
    })

    const actionRoute = conn.fetch.register({
      path: '/api/skill-center/action',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        let body = {}
        try {
          const text = await request.text()
          body = text ? JSON.parse(text) : {}
        } catch {
          return errorResponse(fail('请求体不是合法 JSON', 400))
        }
        try {
          const result = await applyAction(body || {})
          return jsonResponse({
            ok: true,
            value: result.model ? result.model : buildModel(CFG),
            message: result.message || '',
            comboId: result.comboId || '',
            config: result.config || null,
            test: result.test || null,
            plugins: result.plugins || null,
            structure: result.structure || null,
          })
        } catch (error) {
          return errorResponse(error)
        }
      },
    })

    return () => {
      try {
        stateRoute?.()
      } catch {}
      try {
        actionRoute?.()
      } catch {}
    }
  })

  return disposeInject
}
