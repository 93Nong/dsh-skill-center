// Skill 中心（浏览器半）：左侧栏上方一个入口，点开在中间列打开一张管理页。
// 数据来自 Host 插件注册的两条 exact 路由：/api/skill-center/state 与 /action（见 index.js）。
window.__ModuleLoader__.load({
  id: 'dsh-skill-center',
  factory(require) {
    const React = require('react');
    const { useState, useEffect, useMemo, useCallback, useRef } = React;
    const h = React.createElement;
    const PKG = 'dsh-skill-center';

    /* ------------------------------------------------------------------ 主题 */

    const C = {
      bg: 'var(--dsw-alias-bg-base, #1b1d21)',
      l1: 'var(--dsw-alias-bg-layer-1, #232529)',
      l2: 'var(--dsw-alias-bg-layer-2, #2a2d32)',
      l3: 'var(--dsw-alias-bg-layer-3, #32363c)',
      text: 'var(--dsw-alias-label-primary, #e6e8ea)',
      text2: 'var(--dsw-alias-label-secondary, #a8adb5)',
      text3: 'var(--dsw-alias-label-tertiary, #7b8189)',
      border: 'var(--dsw-alias-border-l2, rgba(255,255,255,.08))',
      border3: 'var(--dsw-alias-border-l3, rgba(255,255,255,.14))',
      brand: 'var(--dsw-alias-brand-primary, #4f8bd6)',
      /* 主按钮的填充色不能用 brand-primary：深色主题里它是「近白」，白字压上去就成了一块白方块 */
      fill: 'var(--dsw-alias-button-primary-fill, #2f6feb)',
      fillHover: 'var(--dsw-alias-button-primary-hover, #1f5fd8)',
      onFill: 'var(--dsw-alias-label-primary-inverted, #101214)',
      err: 'var(--dsw-alias-state-error-primary, #e06c75)',
      ok: 'var(--dsw-alias-state-success-primary, #5fb87a)',
      warn: 'var(--dsw-alias-state-warn-primary, #d9a441)',
    };

    /** 线性图标：一个 16px 网格、1.5 描边、颜色跟随文字。界面里不用 emoji 或字符当图标。 */
    const ICON_PATHS = {
      check: ['M20 6L9 17l-5-5'],
      close: ['M18 6L6 18', 'M6 6l12 12'],
      plus: ['M12 5v14', 'M5 12h14'],
      edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'],
      send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
      chevronRight: ['M9 18l6-6-6-6'],
      chevronDown: ['M6 9l6 6 6-6'],
    };
    function Icon({ name, size, stroke }) {
      const paths = ICON_PATHS[name] || [];
      const px = size || 16;
      return h('svg', {
        width: px, height: px, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: stroke || 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true', focusable: 'false',
        style: { flex: '0 0 auto', display: 'block' },
      }, paths.map((d, index) => h('path', { key: index, d })));
    }

    const CSS = `
.sc-root { position:relative; height:100%; min-height:0; display:flex; flex-direction:column; background:${C.bg}; color:${C.text}; font-size:13px; font-variant-numeric:tabular-nums; container-type:inline-size; }
.sc-cat-select { display:none; }
/* dock 窄的时候（默认 45% 宽度）：分类栏收成下拉、详情栏收窄，把地方让给卡片 */
@container (max-width: 780px) {
  .sc-cat { display:none !important; }
  .sc-cat-select { display:block; }
}
@container (max-width: 620px) {
  /* 再窄就把详情变成盖满的抽屉，点卡片滑出来，右上角关掉；
     没选东西的时候整个藏起来，别把列表盖住 */
  .sc-detail-empty { display:none !important; }
  .sc-detail {
    position:absolute; top:0; right:0; bottom:0; width:100% !important; z-index:30;
    background:${C.bg}; border-left:none; box-shadow:-14px 0 34px rgba(0,0,0,.42);
  }
}
.sc-scroll { overflow-y:auto; overscroll-behavior:contain; }
.sc-scroll::-webkit-scrollbar { width:9px; height:9px; }
.sc-scroll::-webkit-scrollbar-thumb { background:var(--dsw-alias-border-l3, rgba(255,255,255,.14)); border-radius:9px; }
.sc-scroll::-webkit-scrollbar-track { background:transparent; }
.sc-row { transition: background .12s ease; }
.sc-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
.sc-card { transition: background .12s ease, border-color .12s ease; }
.sc-card:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); border-color: var(--dsw-alias-border-l3, rgba(255,255,255,.16)); }
.sc-card.on { background: var(--dsw-alias-interactive-bg-active, rgba(255,255,255,.1)); border-color: ${C.brand}; }
.sc-btn { transition: background .12s ease, border-color .12s ease, opacity .12s ease; }
.sc-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(255,255,255,.12)); }
.sc-btn-primary:hover:not(:disabled) { background: ${C.fillHover} !important; }
.sc-btn:disabled { opacity:.45; cursor:default; }
.sc-input, .sc-area { font: inherit; color:${C.text}; background:${C.l1}; border:1px solid ${C.border}; border-radius:8px; outline:none; }
.sc-input:focus, .sc-area:focus { border-color:${C.brand}; }
.sc-tab { transition: background .12s ease, color .12s ease; }
.sc-tab:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
.sc-send-mini {
  flex: 0 0 auto; padding: 1px 6px; border-radius: 6px; cursor: pointer; font: inherit;
  font-size: 10.5px; line-height: 15px; border: 1px solid transparent;
  background: transparent; color: ${C.text3}; opacity: .55;
}
.sc-send-mini:hover { opacity: 1; color: ${C.brand}; background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.08)); }
`;

    /* -------------------------------------------------------------------- 网络 */

    async function callState() {
      const res = await fetch('api/skill-center/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.ok !== true) {
        throw new Error((body && body.error && body.error.message) || 'HTTP ' + res.status);
      }
      return body;
    }

    async function callAction(action, payload) {
      const res = await fetch('api/skill-center/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ action }, payload || {})),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.ok !== true) {
        throw new Error((body && body.error && body.error.message) || 'HTTP ' + res.status);
      }
      return body;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        try {
          const area = document.createElement('textarea');
          area.value = text;
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(area);
          return ok;
        } catch {
          return false;
        }
      }
    }

    /**
     * 把一段话送进当前会话的输入框（不自动回车，用户补完要做的事再发）。
     * inputActions 来自会话作用域的 slot 注入；拿不到就退回复制。
     */
    function sendToComposer(inputActions, text, say) {
      const body = String(text || '').trim();
      if (!body) return false;
      // 斜杠命令要留一个空格收尾，输入框才会把它识别成 skill 命令
      const payload = body.charAt(0) === '/' ? body + ' ' : body;
      const acts = inputActions;
      if (acts && typeof acts.insertText === 'function' && typeof acts.captureInsertion === 'function') {
        try {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const span = acts.captureInsertion();
            if (acts.insertText(payload, span) !== false) {
              if (say) say('已把 ' + body + ' 写进对话输入框（斜杠命令会自己识别），按回车发出去');
              return true;
            }
          }
        } catch (error) { /* 落到复制 */ }
      }
      copyText(payload);
      if (say) say('没能连到对话输入框，已复制，粘贴到对话里就行', 'warn');
      return false;
    }

    /* -------------------------------------------------------------------- 小件 */

    function Btn({ children, onClick, kind, disabled, title, style }) {
      const base = {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 11px', borderRadius: 8, fontSize: 12, lineHeight: '18px',
        cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
        border: '1px solid ' + (kind === 'primary' ? 'transparent' : C.border),
        background: kind === 'primary' ? C.fill : kind === 'ghost' ? 'transparent' : C.l2,
        color: kind === 'primary' ? C.onFill : kind === 'danger' ? C.err : C.text,
      };
      return h('button', {
        type: 'button',
        className: kind === 'primary' ? 'sc-btn sc-btn-primary' : 'sc-btn',
        title, disabled: Boolean(disabled),
        style: Object.assign(base, style || {}),
        onClick: disabled ? undefined : onClick,
      }, children);
    }

    function Tag({ children, tone }) {
      const color = tone === 'brand' ? C.brand : tone === 'err' ? C.err : tone === 'ok' ? C.ok : tone === 'warn' ? C.warn : C.text3;
      return h('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 4,
          border: '1px solid ' + C.border, color, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap',
        },
      }, children);
    }

    /** 自绘勾选框：原生 checkbox 在深色主题里就是个白方块，认不出勾没勾。 */
    function CheckBox({ checked }) {
      return h('span', {
        style: {
          flex: '0 0 auto', width: 15, height: 15, borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, lineHeight: 1, color: C.onFill,
          border: '1px solid ' + (checked ? C.fill : C.border3),
          background: checked ? C.fill : 'transparent',
          transition: 'background .12s ease, border-color .12s ease',
        },
      }, checked ? h(Icon, { name: 'check', size: 11, stroke: 2.4 }) : '');
    }

    /** 卡片右上角的删除按钮：第一下变成红底，再点一下才真删（3 秒后自动取消）。 */
    function DelBtn({ onDelete, title, floating }) {
      const [armed, setArmed] = useState(false);
      useEffect(() => {
        if (!armed) return undefined;
        const timer = setTimeout(() => setArmed(false), 3000);
        return () => clearTimeout(timer);
      }, [armed]);
      const base = {
        width: 18, height: 18, borderRadius: 4, padding: 0, border: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, lineHeight: '18px', cursor: 'pointer', flex: '0 0 auto',
        background: armed ? C.err : 'transparent',
        color: armed ? C.onFill : C.text3,
        opacity: armed ? 1 : 0.55,
      };
      if (floating) Object.assign(base, { position: 'absolute', top: 6, right: 6, zIndex: 3 });
      return h('button', {
        type: 'button',
        className: 'sc-del',
        title: armed ? '再点一次就从本地删除（3 秒内有效）' : (title || '从本地删除'),
        style: base,
        onClick: async (event) => {
          if (event && event.stopPropagation) event.stopPropagation();
          if (!armed) { setArmed(true); return; }
          setArmed(false);
          await onDelete();
        },
      }, h(Icon, { name: 'close', size: 11 }));
    }

    function fmtBytes(bytes) {
      const n = Number(bytes) || 0;
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
      return (n / 1024 / 1024).toFixed(1) + ' MB';
    }

    /** 「它是干什么的」这句话是从哪来的：自己写的 / 中文说明表 / 从 description 抽的。 */
    function summaryLabel(skill) {
      if (skill.summarySource === 'user' || skill.summaryEdited) return '说明：手写';
      if (skill.summarySource === 'zh') return '说明：中文整理';
      return '说明：自动';
    }

    /** 模型 / API 三项存成哪个环境变量：先看 SKILL.md 自己提到了什么，再按 skill 名兜一个。 */
    function guessModelNames(skill) {
      const list = (skill.envNames || []).map((item) => item.name);
      const pick = (re) => list.find((name) => re.test(name)) || '';
      const upper = String(skill.displayName || skill.name || 'SKILL')
        .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return {
        base: pick(/BASE_URL|_URL$|ENDPOINT|HOST/) || upper + '_BASE_URL',
        model: pick(/MODEL/) || upper + '_MODEL',
        key: pick(/API_KEY|_KEY$|TOKEN|SECRET/) || upper + '_API_KEY',
      };
    }

    function SidebarIcon(props) {
      const size = (props && props.size) || 18;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('rect', { x: 3.2, y: 3.2, width: 7.4, height: 7.4, rx: 2.1 }),
        h('rect', { x: 13.4, y: 3.2, width: 7.4, height: 7.4, rx: 2.1, fill: 'currentColor', fillOpacity: 0.3 }),
        h('rect', { x: 3.2, y: 13.4, width: 7.4, height: 7.4, rx: 2.1, fill: 'currentColor', fillOpacity: 0.3 }),
        h('rect', { x: 13.4, y: 13.4, width: 7.4, height: 7.4, rx: 2.1 })
      );
    }

    /* -------------------------------------------------------------------- 页面 */

    /* 兜底：任何子组件抛错都别让整页变空白，把真实报错显示出来。 */
    const ErrorBoundary = React.Component ? class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { err: '' };
      }
      static getDerivedStateFromError(error) {
        return { err: String((error && error.message) || error) };
      }
      componentDidCatch(error, info) {
        try {
          const text = String((error && error.stack) || error) + '\n' + String((info && info.componentStack) || '');
          fetch('api/skill-center/action', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'clientLog', message: 'render: ' + text.slice(0, 4000) }),
          }).catch(() => {});
        } catch (ignored) { /* 记日志失败不影响显示 */ }
      }
      render() {
        if (this.state.err) {
          return h('div', { style: { padding: '18px 16px', color: C.err, fontSize: 13, lineHeight: '20px', wordBreak: 'break-all' } },
            h('div', { style: { fontWeight: 600, marginBottom: 6 } }, '这一页渲染出错了：'),
            this.state.err,
            h('div', { style: { color: C.text3, fontSize: 12, marginTop: 8 } },
              '错误已写进 ~/.dsh/skill-center/client.log，重启一下插件或者把它发给我。'));
        }
        return this.props.children;
      }
    } : null;

    function guarded(node) {
      return ErrorBoundary ? h(ErrorBoundary, null, node) : node;
    }

    function Page(props) {
      const docked = !!(props && props.docked);
      const inputActions = (props && props.inputActions) || null;
      const [model, setModel] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [tab, setTab] = useState('library');
      const [mode, setMode] = useState('skill');
      const [category, setCategory] = useState('all');
      const [query, setQuery] = useState('');
      const [selectedId, setSelectedId] = useState('');
      const [toast, setToast] = useState(null);
      const toastTimer = useRef(null);
      const pluginReloadRef = useRef(null);

      const say = useCallback((text, tone) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ text, tone: tone || 'ok' });
        toastTimer.current = setTimeout(() => setToast(null), 3200);
      }, []);

      const load = useCallback(async (silent) => {
        if (!silent) setBusy(true);
        try {
          const body = await callState();
          setModel(body);
          setError('');
        } catch (e) {
          setError(String((e && e.message) || e));
        } finally {
          if (!silent) setBusy(false);
        }
      }, []);

      const run = useCallback(async (action, payload) => {
        setBusy(true);
        try {
          const body = await callAction(action, payload);
          if (body.value) setModel(body.value);
          if (body.message) say(body.message, 'ok');
          setError('');
          return body;
        } catch (e) {
          const message = String((e && e.message) || e);
          setError(message);
          say(message, 'err');
          return null;
        } finally {
          setBusy(false);
        }
      }, [say]);

      useEffect(() => { load(); }, [load]);
      useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

      const skills = (model && model.skills) || [];
      const categories = (model && model.categories) || [];
      const combos = (model && model.combos) || [];
      const roots = (model && model.roots) || [];

      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return skills.filter((skill) => {
          if (category !== 'all' && skill.categoryKey !== category) return false;
          if (!q) return true;
          return ((skill.displayName || '') + ' ' + skill.name + ' ' + skill.summary + ' ' + skill.description + ' ' + skill.path + ' ' + skill.app).toLowerCase().includes(q);
        });
      }, [skills, category, query]);

      const selected = useMemo(() => skills.find((skill) => skill.id === selectedId) || null, [skills, selectedId]);

      useEffect(() => {
        if (selected && !filtered.some((skill) => skill.id === selected.id)) setSelectedId('');
      }, [filtered, selected]);

      const tabs = [
        { id: 'library', label: '技能库' },
        { id: 'combos', label: '组合' },
        { id: 'sources', label: '来源与托管' },
      ];

      return h('div', { className: 'sc-root' },
        h('style', null, CSS),

        h('header', {
          style: {
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 16px 10px', borderBottom: '1px solid ' + C.border,
            flex: '0 0 auto',
          },
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
            h('span', { style: { display: 'flex', color: C.brand } }, h(SidebarIcon, { size: 17 })),
            h('strong', { style: { fontSize: 15, fontWeight: 600 } }, 'Skill 中心'),
            mode === 'skill' && model ? h('span', { style: { color: C.text3, fontSize: 12 } },
              skills.length + ' 个 skill · ' + combos.length + ' 个组合 · ' + categories.length + ' 个分类') : null
          ),
          h('div', { style: { flex: 1 } }),
          mode === 'skill' ? h('div', {
            style: { display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: C.l1, border: '1px solid ' + C.border },
          }, tabs.map((item) => h('button', {
            key: item.id, type: 'button', className: 'sc-tab',
            onClick: () => setTab(item.id),
            style: {
              padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === item.id ? C.l3 : 'transparent',
              color: tab === item.id ? C.text : C.text2, fontSize: 12, fontFamily: 'inherit',
            },
          }, item.label))) : null,
          h(Btn, {
            onClick: () => {
              if (mode === 'plugin') {
                if (pluginReloadRef.current) pluginReloadRef.current();
              } else {
                load(false);
              }
            },
            disabled: busy,
            title: mode === 'plugin' ? '重新读取插件清单（新装/停用的会一起更新）' : '重新扫描所有技能目录',
          }, mode === 'plugin' ? '刷新列表' : busy ? '…' : '重新扫描'),
          docked
            ? h('div', { style: { display: 'flex', gap: 6 } },
              h(Btn, {
                onClick: () => toggleFull(),
                title: '把这一页铺满整个窗口，左右两边都收起来，专心改东西',
              }, '全屏'),
              h(Btn, {
                onClick: () => {
                  preferMain = true;
                  try { if (CTX) CTX.layout.selectPanel(KIND); } catch (error) { /* 没有 layout 就算了 */ }
                },
                title: '把这一页挪到中间，对话让位，编辑区更宽',
              }, '占满中间'))
            : h(Btn, {
              onClick: () => {
                preferMain = false;
                try { if (CTX) CTX.layout.selectPanel(null); } catch (error) { /* 没有 layout 就算了 */ }
                if (CTX) openDock(CTX, () => {});
              },
              title: '回到右侧栏，中间留给对话',
            }, '回到右栏')
        ),

        error ? h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
            background: 'color-mix(in srgb, ' + C.err + ' 12%, transparent)',
            color: C.err, fontSize: 12, borderBottom: '1px solid ' + C.border,
          },
        }, h(Icon, { name: 'close', size: 13 }), h('span', { style: { flex: 1, wordBreak: 'break-all' } }, error)) : null,

        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '7px 16px', borderBottom: '1px solid ' + C.border, background: C.l1, flex: '0 0 auto',
          },
        },
          h('div', {
            style: { display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: C.bg, border: '1px solid ' + C.border },
          }, [{ id: 'skill', label: '技能' }, { id: 'plugin', label: '插件' }].map((item) => h('button', {
            key: item.id, type: 'button', className: 'sc-tab',
            onClick: () => setMode(item.id),
            style: {
              padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: mode === item.id ? C.l3 : 'transparent',
              color: mode === item.id ? C.text : C.text2, fontSize: 12, fontFamily: 'inherit',
            },
          }, item.label))),
          h('span', { style: { color: C.text3, fontSize: 12, minWidth: 0 } },
            mode === 'skill'
              ? '本机所有 Agent 的 skill：说明、归类、组合、托管'
              : 'DSH 自己的插件：启用状态、挂载条目、目录里的配置文件')
        ),

        guarded(h('div', { style: { display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' } },
          mode === 'skill' && !model && !error
            ? h('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 } }, '正在扫描本机的 skill…')
            : null,

          mode === 'skill' && model && tab === 'library' ? h(Library, {
            model, categories, filtered, category, setCategory, query, setQuery,
            selected, setSelectedId, run, busy, say, inputActions,
          }) : null,

          mode === 'skill' && model && tab === 'combos' ? h(Combos, { model, combos, skills, run, busy, say, inputActions }) : null,

          mode === 'skill' && model && tab === 'sources' ? h(Sources, { model, roots, run, busy, say }) : null,

          mode === 'plugin' ? h(Plugins, { say, reloadRef: pluginReloadRef }) : null
        )),

        toast ? h('div', {
          style: {
            position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)',
            padding: '8px 14px', borderRadius: 10, fontSize: 12, zIndex: 40, maxWidth: '70%',
            background: C.l3, border: '1px solid ' + C.border3,
            color: toast.tone === 'err' ? C.err : C.text,
            boxShadow: '0 8px 24px rgba(0,0,0,.32)', wordBreak: 'break-all',
          },
        }, toast.text) : null
      );
    }

    /* ------------------------------------------------------------------ 插件页 */

    function PluginRow({ plugin, on, onClick, onDelete }) {
      return h('div', {
        className: 'sc-card' + (on ? ' on' : ''),
        onClick,
        title: plugin.summary || plugin.description || plugin.name,
        style: {
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid ' + (on ? C.border3 : C.border), background: on ? C.l2 : C.l1, minWidth: 0,
        },
      },
        h('span', {
          style: {
            width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto',
            background: plugin.enabled ? C.ok : C.text3, opacity: plugin.enabled ? 1 : 0.45,
          },
        }),
        h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
          h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 } },
            h('span', { style: { fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, plugin.displayName || plugin.name),
            plugin.version ? h('span', { style: { color: C.text3, fontSize: 11, flex: '0 0 auto' } }, 'v' + plugin.version) : null
          ),
          h('div', { style: { color: C.text2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            String(plugin.summary || plugin.description || '（没有描述）'))
        ),
        plugin.hasConfigCard ? h(Tag, { tone: 'ok' }, '有配置') : null,
        plugin.enabled ? null : h(Tag, null, '停用'),
        onDelete ? h(DelBtn, { onDelete, title: '从本地删除这个插件' }) : null
      );
    }

    function PluginCard({ plugin, on, onClick, onDelete }) {
      const tags = [];
      if (plugin.hasConfigCard) tags.push('有配置卡片');
      if (plugin.configs && plugin.configs.length) tags.push(plugin.configs.length + ' 个配置文件');
      return h('div', {
        className: 'sc-card' + (on ? ' on' : ''),
        onClick,
        title: (plugin.summary || plugin.description || plugin.name) + '\n' + plugin.name,
        style: {
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 5, padding: '9px 11px 8px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid ' + (on ? C.border3 : C.border), background: on ? C.l2 : C.l1,
          minHeight: 92, minWidth: 0, overflow: 'hidden', opacity: plugin.enabled ? 1 : 0.72,
        },
      },
        onDelete ? h(DelBtn, { onDelete, floating: true, title: '从本地删除这个插件' }) : null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
          h('span', {
            style: { width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto', background: plugin.enabled ? C.ok : C.text3 },
          }),
          h('span', { style: { flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, plugin.displayName || plugin.name),
          plugin.version ? h('span', { style: { color: C.text3, fontSize: 10, flex: '0 0 auto' } }, 'v' + plugin.version) : null
        ),
        h('div', {
          style: {
            color: C.text2, fontSize: 12, lineHeight: '17px', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          },
        }, String(plugin.summary || plugin.description || '（没有描述）')),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 'auto', color: C.text3, fontSize: 11 } },
          h('span', null, plugin.availability === 'profile' ? '自己装的' : 'DSH 自带'),
          plugin.enabled ? null : h('span', { style: { color: C.warn } }, '· 停用'),
          tags.length ? h('span', null, '· ' + tags.join(' · ')) : null
        )
      );
    }

    function PluginDetail({ plugin, say, onClose, onToggle, busy, onSaved }) {
      const [editing, setEditing] = useState(null);
      const [text, setText] = useState('');
      const [cfgBusy, setCfgBusy] = useState(false);
      const [descEditing, setDescEditing] = useState(false);
      const [descText, setDescText] = useState('');
      const [nameEditing, setNameEditing] = useState(false);
      const [nameText, setNameText] = useState('');
      const [nameBusy, setNameBusy] = useState(false);
      const [miscOpen, setMiscOpen] = useState(false);
      const [descBusy, setDescBusy] = useState(false);
      const [struct, setStruct] = useState(null);
      const [structPath, setStructPath] = useState('');
      const [structBusy, setStructBusy] = useState(false);
      const [drafts, setDrafts] = useState({});
      const [openKeys, setOpenKeys] = useState('');
      const [newOpen, setNewOpen] = useState(false);
      const [newParent, setNewParent] = useState('');
      const [newKey, setNewKey] = useState('');
      const [newVal, setNewVal] = useState('');
      const [showEmpty, setShowEmpty] = useState(false);
      const [structSource, setStructSource] = useState('file');
      const [openSecs, setOpenSecs] = useState({});
      const rows = plugin.rows || [];
      const overrides = plugin.overrides || [];

      useEffect(() => {
        let dead = false;
        const json = (plugin.configs || []).find((f) => /\.json$/i.test(f.name));
        const load = async (payload, source, filePath) => {
          setStructSource(source);
          setStructPath(filePath);
          try {
            const body = await callAction('pluginStructure', payload);
            if (!dead) setStruct((body && body.structure) || null);
          } catch (e) {
            if (!dead) setStruct(null);
          }
        };
        if (json) {
          load({ name: plugin.name, path: json.path }, 'file', json.path);
        } else if (plugin.profileConfigId) {
          load({ name: plugin.name, source: 'profile' }, 'profile', '');
        } else {
          setStruct(null);
          setStructPath('');
        }
        return () => { dead = true; };
      }, [plugin.name, plugin.configs, plugin.profileConfigId]);

      async function saveDesc() {
        setDescBusy(true);
        try {
          const body = await act('setPluginSummary', { name: plugin.name, text: descText });
          if (body) {
            setDescEditing(false);
            if (onSaved) onSaved();
          }
        } finally {
          setDescBusy(false);
        }
      }

      async function resetDesc() {
        setDescBusy(true);
        try {
          const body = await act('resetPluginSummary', { name: plugin.name });
          if (body) {
            setDescEditing(false);
            setDescText('');
            if (onSaved) onSaved();
          }
        } finally {
          setDescBusy(false);
        }
      }

      async function saveName(reset) {
        setNameBusy(true);
        try {
          const body = await act(reset ? 'resetPluginName' : 'setPluginName', reset ? { name: plugin.name } : { name: plugin.name, text: nameText });
          if (body) {
            setNameEditing(false);
            setNameText('');
            if (onSaved) onSaved();
          }
        } finally {
          setNameBusy(false);
        }
      }

      async function act(action, payload) {
        try {
          const body = await callAction(action, payload);
          if (body.message) say(body.message, 'ok');
          return body;
        } catch (e) {
          say(String((e && e.message) || e), 'err');
          return null;
        }
      }

      async function openFile(file) {
        setCfgBusy(true);
        try {
          const body = await act('readPluginConfig', { name: plugin.name, path: file.path });
          if (body) {
            setText((body.config && body.config.text) || '');
            setEditing(file);
          }
        } finally {
          setCfgBusy(false);
        }
      }

      async function saveFile() {
        setCfgBusy(true);
        try {
          const body = await act('writePluginConfig', { name: plugin.name, path: editing.path, text });
          if (body) setEditing(null);
        } finally {
          setCfgBusy(false);
        }
      }

      const valOf = (p, fallback) => (Object.prototype.hasOwnProperty.call(drafts, p) ? drafts[p] : (fallback == null ? '' : String(fallback)));
      const setDraft = (p, v) => setDrafts((d) => Object.assign({}, d, { [p]: v }));
      const applyStruct = (body) => { if (body && body.structure) { setStruct(body.structure); setDrafts({}); } };

      const fieldCell = (lb, p) => h('div', { style: { flex: '1 1 auto', minWidth: 110 } },
        h('div', { style: { fontSize: 12, color: C.text2, lineHeight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, lb),
        h('div', {
          style: { fontSize: 10, color: C.text3, lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          title: p,
        }, p));

      const shortUrl = (u) => String(u || '').replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '');

      const hTag = (text, title) => h('span', {
        title: title || '',
        style: {
          flex: '0 0 auto', fontSize: 10, color: C.text3, border: '1px solid ' + C.border,
          borderRadius: 8, padding: '1px 7px', lineHeight: '15px', cursor: 'help',
        },
      }, text);

      const modelList = struct ? (struct.models || []).filter((m) => showEmpty || String(valOf(m.path, m.value)).trim() !== '') : [];
      const urlList = struct ? (struct.urls || []).filter((u) => showEmpty || String(valOf(u.path, u.value)).trim() !== '') : [];
      const keyList = struct ? (struct.keys || []).filter((k) => showEmpty || k.set || String(valOf(k.path, '')).trim() !== '') : [];
      const hiddenCount = struct
        ? ((struct.models || []).length - modelList.length) + ((struct.urls || []).length - urlList.length) + ((struct.keys || []).length - keyList.length)
        : 0;

      const sections = struct ? (struct.sections || []) : [];
      const secOpen = (sec) => !!openSecs[sec.where];
      const usedDirs = {};
      sections.forEach((s) => (s.localModels || []).forEach((m) => { usedDirs[m.modelsDir] = true; }));
      const restLocals = ((struct && struct.locals) || []).filter((it) => !usedDirs[it.modelsDir]);
      const restLocalsRow = restLocals.length
        ? h('div', { style: { marginBottom: 8 } },
          h('div', { style: { fontSize: 10, color: C.text3, marginBottom: 2 } }, '其他本机模型（配置里没直接用到，但硬盘上有）'),
          restLocals.map((it) => h('div', { key: it.modelsDir, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 0' } },
            h('div', { style: { flex: '1 1 auto', minWidth: 100 } },
              h('div', { style: { fontSize: 11, color: C.text2 } }, it.key + (it.port ? ' · 端口 ' + it.port : '')),
              it.use ? h('div', { style: { fontSize: 10, color: C.text3 } }, it.use) : null,
              h('div', { style: { fontSize: 10, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: it.modelsDir }, it.modelsDir)),
            h('span', { style: { fontSize: 10, color: C.text3 } }, fmtBytes(it.bytes)),
            h(Btn, { onClick: () => act('openPluginDir', { name: plugin.name, path: it.modelsDir }), style: { padding: '0 6px', fontSize: 11 } }, '打开')
          ))
        )
        : null;

      const miscList = (struct && struct.misc) || [];
      const miscCard = miscList.length
        ? h('div', { style: { border: '1px solid ' + C.border, borderRadius: 8, marginTop: 8, overflow: 'hidden' } },
          h('button', {
            type: 'button', className: 'sc-row', onClick: () => setMiscOpen(!miscOpen),
            style: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '7px 9px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' },
          },
            h('span', { style: { fontSize: 10, color: C.text3, width: 10 } }, miscOpen ? h(Icon, { name: 'chevronDown', size: 11 }) : h(Icon, { name: 'chevronRight', size: 11 })),
            h('span', { style: { fontWeight: 600, fontSize: 12 } }, '其他设置'),
            h('span', { style: { fontSize: 10, color: C.text3 } }, '开关 / 数字 / 短文本，共 ' + miscList.length + ' 项'),
            h('span', { style: { flex: 1 } }),
            h('span', { style: { fontSize: 11, color: C.brand } }, miscOpen ? '收起' : '展开')
          ),
          miscOpen
            ? h('div', { style: { padding: '0 9px 7px' } },
              miscList.map((f) => h('div', { key: f.path, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 0' } },
                h('div', { style: { flex: '1 1 110px', minWidth: 0 } },
                  h('div', { style: { fontSize: 12, color: C.text2 } }, f.label || f.key || '', f.label && f.label !== f.key ? h('span', { style: { fontSize: 10, color: C.text3, marginLeft: 4 } }, f.key) : null),
                  h('div', { style: { fontSize: 10, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: f.path }, f.path)),
                f.kind === 'bool'
                  ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    h('button', {
                      type: 'button', onClick: () => saveField(f.path, f.value ? 'false' : 'true'), disabled: structBusy,
                      title: f.value ? '现在是开，点一下关掉' : '现在是关，点一下打开',
                      style: { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' },
                    }, h(CheckBox, { checked: !!f.value })),
                    h('span', { style: { fontSize: 11, color: C.text3 } }, f.value ? '开' : '关'))
                  : h('div', { style: { display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 150px', minWidth: 0 } },
                    h('input', {
                      className: 'sc-input', value: valOf(f.path, f.value), spellCheck: false,
                      onChange: (e) => setDraft(f.path, e.target.value),
                      style: { flex: '1 1 90px', minWidth: 0, padding: '2px 6px', fontSize: 11 },
                    }),
                    h(Btn, { onClick: () => saveField(f.path, valOf(f.path, f.value)), disabled: structBusy, style: { padding: '1px 8px' } }, '保存'))
              ))
            )
            : null
        )
        : null;
      const fieldAction = structSource === 'profile' ? 'setProfileField' : 'setPluginField';

      async function saveUrl(u) {
        setStructBusy(true);
        try {
          const body = await act(fieldAction, { name: plugin.name, path: structPath, field: u.path, value: valOf(u.path, u.value) });
          if (body && body.structure) setStruct(body.structure);
        } finally {
          setStructBusy(false);
        }
      }

      async function saveField(p, value) {
        setStructBusy(true);
        try {
          const body = await act(fieldAction, { name: plugin.name, path: structPath, field: p, value });
          if (body && body.structure) setStruct(body.structure);
        } finally {
          setStructBusy(false);
        }
      }

      async function saveModel(m) {
        setStructBusy(true);
        try {
          let body = await act(fieldAction, { name: plugin.name, path: structPath, field: m.path, value: valOf(m.path, m.value) });
          if (body && m.providerPath) {
            const next = await act(fieldAction, { name: plugin.name, path: structPath, field: m.providerPath, value: valOf(m.providerPath, m.providerValue) });
            if (next) body = next;
          }
          if (body && body.structure) setStruct(body.structure);
        } finally {
          setStructBusy(false);
        }
      }

      async function saveKey(k) {
        setStructBusy(true);
        try {
          const body = await act(fieldAction, { name: plugin.name, path: structPath, field: k.path, value: valOf(k.path, '') });
          if (body && body.structure) { setOpenKeys(''); setStruct(body.structure); }
        } finally {
          setStructBusy(false);
        }
      }

      async function clearKey(k) {
        setStructBusy(true);
        try {
          const body = await act(fieldAction, { name: plugin.name, path: structPath, field: k.path, value: '' });
          if (body && body.structure) setStruct(body.structure);
        } finally {
          setStructBusy(false);
        }
      }

      async function saveEnvKey(f) {
        setStructBusy(true);
        try {
          const body = await act('writeDshEnv', { env: f.envName, value: valOf(f.path, '') });
          if (body) {
            setOpenKeys('');
            setDraft(f.path, '');
            if (structSource === 'profile') {
              const again = await act('pluginStructure', { name: plugin.name, source: 'profile' });
              if (again && again.structure) setStruct(again.structure);
            }
          }
        } finally {
          setStructBusy(false);
        }
      }

      async function addField() {
        setStructBusy(true);
        try {
          const body = await act('addPluginField', { name: plugin.name, path: structPath, parent: newParent, key: newKey, value: newVal });
          if (body) { setNewOpen(false); setNewKey(''); setNewVal(''); applyStruct(body); }
        } finally {
          setStructBusy(false);
        }
      }

      const label = (t) => h('div', { style: { color: C.text3, fontSize: 11, margin: '14px 0 5px' } }, t);
      const kv = (k, v) => h('div', { style: { display: 'flex', gap: 8, fontSize: 12, padding: '2px 0', lineHeight: '17px' } },
        h('span', { style: { color: C.text3, width: 34, flex: '0 0 auto' } }, k),
        h('span', { style: { flex: 1, minWidth: 0, wordBreak: 'break-all' } }, v));

      return h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
          h('div', { style: { flex: 1, minWidth: 0 } },
            nameEditing
              ? h('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' } },
                h('input', {
                  className: 'sc-input', value: nameText, spellCheck: false, placeholder: '给它起个好认的名字',
                  onChange: (e) => setNameText(e.target.value),
                  style: { flex: '1 1 140px', minWidth: 0, padding: '3px 6px', fontSize: 13 },
                }),
                h(Btn, { kind: 'primary', onClick: () => saveName(false), disabled: nameBusy, style: { padding: '2px 8px' } }, '保存'),
                h(Btn, { onClick: () => { setNameEditing(false); setNameText(''); }, disabled: nameBusy, style: { padding: '2px 8px' } }, '取消'),
                plugin.nameSource === 'user' ? h(Btn, { onClick: () => saveName(true), disabled: nameBusy, style: { padding: '2px 8px' } }, '恢复原名') : null
              )
              : h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                h('span', { style: { fontWeight: 600, fontSize: 13, wordBreak: 'break-all' } }, plugin.displayName || plugin.name),
                plugin.nameSource === 'user' ? hTag('改过名', '只在这里显示；插件本身的名字没动') : null,
                h(Btn, { onClick: () => { setNameText(plugin.displayName || plugin.name); setNameEditing(true); }, style: { padding: '0 6px', fontSize: 11 } }, '改名')
              ),
            plugin.nameSource === 'user' ? h('div', { style: { color: C.text3, fontSize: 10, marginTop: 2, wordBreak: 'break-all' } }, '原名 ' + plugin.name) : null,
            plugin.version ? h('div', { style: { color: C.text3, fontSize: 12, marginTop: 2 } }, 'v' + plugin.version) : null
          ),
          h('button', {
            type: 'button', className: 'sc-row', onClick: onClose, title: '关闭',
            style: { border: 'none', background: 'transparent', color: C.text3, cursor: 'pointer', fontSize: 15, lineHeight: '18px', padding: 2 },
          }, h(Icon, { name: 'close', size: 13 }))
        ),
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 } },
          h(Tag, { tone: plugin.enabled ? 'ok' : undefined }, plugin.enabled ? '已启用' : '已停用'),
          h(Tag, null, plugin.availability === 'profile' ? '自己装的' : 'DSH 自带'),
          plugin.self ? h(Tag, { tone: 'warn' }, '当前插件') : null,
          plugin.hasConfigCard ? h(Tag, { tone: 'ok' }, '有配置卡片') : null
        ),
        plugin.usesHostModel
          ? h('div', { style: { marginTop: 10, padding: '6px 8px', border: '1px dashed ' + C.border, borderRadius: 6 } },
            h('div', { style: { fontSize: 12, color: C.text2 } },
              '模型：跟随 DSH 当前模型',
              plugin.hostModel && (plugin.hostModel.provider || plugin.hostModel.model)
                ? '（' + [plugin.hostModel.provider, plugin.hostModel.model].filter(Boolean).join(' / ') + '）'
                : ''),
            h('div', { style: { fontSize: 10, color: C.text3, marginTop: 2, wordBreak: 'break-all' } },
              '这个插件没有自己的模型配置，调用的是 DSH 的默认模型；要换模型到 ' + ((plugin.hostModel && plugin.hostModel.file) || 'profile 的 cordis.patch.yml'))
          )
          : null,
        h('div', { style: { marginTop: 12 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 } },
            h('span', { style: { color: C.text3, fontSize: 11, flex: 1 } }, '说明（这个插件有什么用）'),
            h(Tag, { tone: plugin.summarySource === 'user' ? 'brand' : undefined },
              plugin.summarySource === 'user' ? '手写' : plugin.summarySource === 'zh' ? '中文整理' : '原文'),
            descEditing ? null : h(Btn, {
              onClick: () => { setDescText(String(plugin.summary || plugin.description || '')); setDescEditing(true); },
              style: { padding: '1px 8px' },
            }, '编辑')
          ),
          descEditing
            ? h('div', null,
              h('textarea', {
                className: 'sc-area', value: descText, spellCheck: false,
                onChange: (e) => setDescText(e.target.value),
                style: { width: '100%', minHeight: 78, padding: '7px 9px', fontSize: 12, lineHeight: '19px', resize: 'vertical' },
              }),
              h('div', { style: { display: 'flex', gap: 6, marginTop: 6 } },
                h(Btn, { kind: 'primary', disabled: descBusy, onClick: saveDesc }, descBusy ? '保存中…' : '保存'),
                h(Btn, { disabled: descBusy, onClick: () => setDescEditing(false) }, '取消'),
                h(Btn, { disabled: descBusy, onClick: resetDesc, title: '回到内置的中文说明（没有就回到插件原文）' }, '恢复默认')
              )
            )
            : h('div', { style: { fontSize: 13, lineHeight: '20px', color: C.text2 } },
              String(plugin.summary || plugin.description || '（没有说明）')),

          plugin.description && plugin.description !== plugin.summary
            ? h('div', { style: { marginTop: 6, fontSize: 11, lineHeight: '17px', color: C.text3, wordBreak: 'break-all' } },
              '插件原文：' + String(plugin.description))
            : null
        ),
        label('信息'),
        kv('来源', plugin.source || '（随 DSH 安装）'),
        kv('目录', plugin.dir || '（读不到）'),

        rows.length ? label('挂载的条目（' + rows.length + '）') : null,
        rows.length ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
          rows.map((row) => h('div', {
            key: row.rowId || row.moduleName,
            style: { display: 'flex', gap: 8, fontSize: 11, color: C.text2, lineHeight: '16px', wordBreak: 'break-all' },
          },
            h('span', { style: { color: C.text3, flex: '0 0 auto', minWidth: 60 } }, row.rowId || '—'),
            h('span', { style: { flex: 1, minWidth: 0 } }, row.moduleName + (row.entryId ? ' · ' + row.entryId : ''))
          ))) : null,

        overrides.length ? label('被它覆盖的条目（' + overrides.length + '）') : null,
        overrides.length ? h('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
          overrides.map((one) => h(Tag, { key: one }, one))) : null,

        struct
          ? h('div', null,
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 5px' } },
              h('span', { style: { color: C.text3, fontSize: 11, flex: 1 } }, '模型 / 地址 / 密钥（按子系统分组，改了直接写回）'),
              hTag(structSource === 'profile' ? 'profile' : '文件', structSource === 'profile' ? '这些是 profile 的 cordis.patch.yml 里的配置（多数插件的真正设置在这里）' : '这些是插件自己目录/数据目录里的配置文件'),
              h(Btn, { onClick: () => act('openPluginDir', { name: plugin.name, path: structPath || (struct && struct.configDir) || '' }), style: { padding: '1px 8px' } }, '打开所在文件夹')
            ),
            h('div', { style: { fontSize: 11, color: C.text3, marginBottom: 6, wordBreak: 'break-all' } },
              '改的是 ' + (structSource === 'profile' ? (struct.file + '（' + ((struct.profile && struct.profile.name) || '') + '）') : struct.file)),
            h('datalist', { id: 'sc-models' }, (struct.modelOptions || []).map((o) => h('option', { key: o, value: o }))),
            h('datalist', { id: 'sc-providers' }, (struct.providerOptions || []).map((o) => h('option', { key: o, value: o }))),
            sections.length ? null : h('div', { style: { fontSize: 11, color: C.text3 } }, '这个配置里没有模型 / 地址 / 密钥这类字段，可以用下面的文本编辑直接改。'),
            restLocalsRow,
            miscCard,

            sections.map((sec) => {
              const vis = sec.fields.filter((f) => showEmpty || secOpen(sec) || (f.kind === 'key' || f.kind === 'envkey' ? f.set : String(valOf(f.path, f.value)).trim() !== ''));
              const hidden = sec.fields.length - vis.length;
              return h('div', {
                key: sec.where || 'root',
                style: { border: '1px solid ' + C.border, borderRadius: 8, padding: '7px 9px', marginBottom: 8 },
              },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 } },
                  h('span', { style: { fontWeight: 600, fontSize: 12 } }, sec.label),
                  h('span', { style: { fontSize: 10, color: C.text3, fontFamily: 'ui-monospace, Consolas, monospace' } }, sec.where),
                  sec.disabled ? hTag('未启用', '这个子系统在配置里是关着的（enabled: false）') : sec.local === 'local' ? h(Tag, { tone: 'ok' }, sec.localLabel) : sec.local === 'inherit' ? hTag(sec.localLabel || '跟随 DSH 默认模型', '这几项留空就是跟随 DSH 当前用的模型（deepseek）') : sec.local === 'cloud' ? h(Tag, null, sec.localLabel || '云端') : sec.local === 'login' ? hTag(sec.localLabel || '需要登录', '这一组是登录态（Cookie / Token），不是 API key') : h(Tag, { tone: 'warn' }, '还没填地址'),
                  sec.localFolder ? h(Btn, { onClick: () => act('openPluginDir', { name: plugin.name, path: sec.localFolder }), style: { padding: '0 6px', fontSize: 11 } }, '打开模型目录') : null,
                  sec.local === 'local' && !sec.localFolder && sec.baseUrl ? hTag('本机服务 ' + shortUrl(sec.baseUrl), '这一组连的是本机服务，没有单独的模型目录') : null,
                  sec.provider ? hTag('provider: ' + sec.provider, '这一组用的是哪个 provider') : null,
                  h('span', { style: { flex: 1 } }),
                  hidden > 0
                    ? h('button', {
                      type: 'button', className: 'sc-row',
                      onClick: () => setOpenSecs((m) => Object.assign({}, m, { [sec.where]: !m[sec.where] })),
                      style: { border: 'none', background: 'transparent', color: C.text3, cursor: 'pointer', fontSize: 11, padding: '1px 4px' },
                    }, secOpen(sec) ? '收起' : '配置（' + hidden + ' 项未填）')
                    : null
                ),
                sec.localNote ? h('div', { style: { fontSize: 11, color: C.text3, marginBottom: 4 } }, sec.localNote) : null,
                vis.length === 0
                  ? h('div', { style: { fontSize: 11, color: C.text3 } },
                    sec.inherit
                      ? '这几项留空就是跟随 DSH 当前用的模型，不用配；想固定成别的模型再点上面的「配置」。'
                      : sec.disabled
                        ? '这个子系统现在是关着的（enabled: false），要用就先在配置里打开。'
                        : '这一组还没配，点上面的「配置」就能填。')
                  : null,
                vis.length
                  ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
                    vis.map((f) => {
                      if (f.kind === 'provider') {
                        return h('div', { key: f.path, style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 2 } },
                          fieldCell(f.label, f.path),
                          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                            h('input', {
                              className: 'sc-input', list: 'sc-providers', placeholder: 'provider（ollama / local / openai）', spellCheck: false,
                              value: valOf(f.path, f.value),
                              onChange: (e) => setDraft(f.path, e.target.value),
                              style: { flex: '1 1 120px', minWidth: 0, padding: '3px 6px', fontSize: 12 },
                            }),
                            h(Btn, { onClick: () => saveUrl(f), disabled: structBusy, style: { padding: '2px 8px' } }, '保存')
                          )
                        );
                      }
                      if (f.kind === 'model') {
                        return h('div', { key: f.path, style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 2 } },
                          fieldCell(f.label, f.path),
                          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                            h('input', {
                              className: 'sc-input', list: 'sc-models', placeholder: '留空 = 跟随 DSH 默认', spellCheck: false,
                              value: valOf(f.path, f.value),
                              onChange: (e) => setDraft(f.path, e.target.value),
                              style: { flex: '1 1 130px', minWidth: 0, padding: '3px 6px', fontSize: 12 },
                            }),
                            f.providerPath
                              ? h('input', {
                                className: 'sc-input', list: 'sc-providers', placeholder: 'provider', spellCheck: false,
                                value: valOf(f.providerPath, f.providerValue),
                                onChange: (e) => setDraft(f.providerPath, e.target.value),
                                style: { flex: '0 1 84px', minWidth: 60, padding: '3px 6px', fontSize: 12 },
                              })
                              : null,
                            h(Btn, { onClick: () => saveModel(f), disabled: structBusy, style: { padding: '2px 8px' } }, '保存'),
                            h(Btn, {
                              onClick: async () => {
                                setStructBusy(true);
                                try {
                                  const body = await act(fieldAction, { name: plugin.name, path: structPath, field: f.path, value: '' });
                                  if (body && body.structure) setStruct(body.structure);
                                } finally { setStructBusy(false); }
                              },
                              disabled: structBusy, title: '清空这一项，就等于跟随 DSH 当前用的模型（deepseek）',
                              style: { padding: '2px 8px' },
                            }, '用 DSH 默认')
                          )
                        );
                      }
                      if (f.kind === 'url') {
                        return h('div', { key: f.path, style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 2 } },
                          fieldCell(f.label, f.path),
                          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                            h('input', {
                              className: 'sc-input', placeholder: 'http://127.0.0.1:11434/v1', spellCheck: false,
                              value: valOf(f.path, f.value),
                              onChange: (e) => setDraft(f.path, e.target.value),
                              style: { flex: '1 1 140px', minWidth: 0, padding: '3px 6px', fontSize: 12 },
                            }),
                            h(Btn, { onClick: () => saveUrl(f), disabled: structBusy, style: { padding: '2px 8px' } }, '保存')
                          )
                        );
                      }
                      if (f.kind === 'login') {
                        const openKey = openKeys === f.path;
                        return h('div', { key: f.path, style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 2 } },
                          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                            fieldCell(f.label, f.path),
                            h(Tag, { tone: f.set ? 'ok' : undefined }, f.set ? '已登录（已保存）' : '还没登录'),
                            f.set ? h('span', { style: { color: C.text3, fontSize: 11 } }, f.preview) : null,
                            h('span', { style: { flex: 1 } }),
                            sec.loginUrl ? h(Btn, { onClick: () => act('openExternal', { url: sec.loginUrl }), style: { padding: '2px 8px' } }, '打开登录页') : null,
                            h(Btn, { onClick: () => { setOpenKeys(openKey ? '' : f.path); setDraft(f.path, ''); }, style: { padding: '2px 8px' } }, f.set ? '换登录态' : '粘贴登录态')
                          ),
                          h('div', { style: { fontSize: 10, color: C.text3 } }, '这是登录后得到的 Cookie / 登录凭据，不是 API key：先点「打开登录页」登录，再从浏览器复制整条 Cookie 粘进来。'),
                          openKey
                            ? h('div', { style: { display: 'flex', gap: 4, alignItems: 'flex-start' } },
                              h('textarea', {
                                className: 'sc-area', rows: 3, placeholder: '粘贴整条 Cookie', spellCheck: false,
                                value: valOf(f.path, ''),
                                onChange: (e) => setDraft(f.path, e.target.value),
                                style: { flex: 1, minWidth: 0, fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace' },
                              }),
                              h('span', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                                h(Btn, { kind: 'primary', onClick: () => saveKey(f), disabled: structBusy, style: { padding: '2px 8px' } }, '保存'),
                                h(Btn, { onClick: () => { setOpenKeys(''); setDraft(f.path, ''); }, disabled: structBusy, style: { padding: '2px 8px' } }, '取消')
                              )
                            )
                            : null
                        );
                      }
                      if (f.kind === 'envkey') {
                        const openKey = openKeys === f.path;
                        return h('div', { key: f.path, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                          fieldCell(f.label + ' · ' + f.envName, f.path),
                          h(Tag, { tone: f.set ? 'ok' : undefined }, f.set ? '已设置' : '未设置'),
                          openKey
                            ? h('span', { style: { display: 'flex', gap: 4, alignItems: 'center', flex: '1 0 100%' } },
                              h('input', {
                                className: 'sc-input', type: 'password', placeholder: '粘贴 key（写进 ~/.dsh/.env）', spellCheck: false, autoComplete: 'new-password',
                                value: valOf(f.path, ''),
                                onChange: (e) => setDraft(f.path, e.target.value),
                                style: { flex: 1, minWidth: 0, padding: '3px 6px', fontSize: 12 },
                              }),
                              h(Btn, { kind: 'primary', onClick: () => saveEnvKey(f), disabled: structBusy, style: { padding: '2px 8px' } }, '写入 .env'),
                              h(Btn, { onClick: () => { setOpenKeys(''); setDraft(f.path, ''); }, disabled: structBusy, style: { padding: '2px 8px' } }, '取消')
                            )
                            : h('span', { style: { display: 'flex', gap: 4 } },
                              h(Btn, { onClick: () => { setOpenKeys(f.path); setDraft(f.path, ''); }, style: { padding: '2px 8px' } }, f.set ? '换 key' : '填 key')
                            )
                        );
                      }
                      const openKey = openKeys === f.path;
                      return h('div', { key: f.path, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                        fieldCell(f.label, f.path),
                        h(Tag, { tone: f.set ? 'ok' : undefined }, f.set ? '已设置' : '未设置'),
                        f.set ? h('span', { style: { color: C.text3, fontSize: 11, flex: '0 0 auto' } }, f.preview) : null,
                        openKey
                          ? h('span', { style: { display: 'flex', gap: 4, alignItems: 'center', flex: '1 0 100%' } },
                            h('input', {
                              className: 'sc-input', type: 'password', placeholder: '粘贴新的 key', spellCheck: false, autoComplete: 'new-password',
                              value: valOf(f.path, ''),
                              onChange: (e) => setDraft(f.path, e.target.value),
                              style: { flex: 1, minWidth: 0, padding: '3px 6px', fontSize: 12 },
                            }),
                            h(Btn, { kind: 'primary', onClick: () => saveKey(f), disabled: structBusy, style: { padding: '2px 8px' } }, '保存'),
                            h(Btn, { onClick: () => { setOpenKeys(''); setDraft(f.path, ''); }, disabled: structBusy, style: { padding: '2px 8px' } }, '取消')
                          )
                          : h('span', { style: { display: 'flex', gap: 4 } },
                            h(Btn, { onClick: () => { setOpenKeys(f.path); setDraft(f.path, ''); }, style: { padding: '2px 8px' } }, f.set ? '改' : '填写'),
                            f.set ? h(Btn, { onClick: () => clearKey(f), disabled: structBusy, style: { padding: '2px 8px' } }, '清空') : null
                          )
                      );
                    })
                  )
                  : h('div', { style: { fontSize: 11, color: C.text3 } }, '（这一组都还没配）'),
                sec.localModels && sec.localModels.length
                  ? h('div', { style: { marginTop: 6, paddingTop: 5, borderTop: '1px dashed ' + C.border } },
                    h('div', { style: { fontSize: 10, color: C.text3, marginBottom: 2 } }, '本机模型（硬盘上真实存在的权重）'),
                    sec.localModels.map((m) => h('div', { key: m.modelsDir, style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 0' } },
                      h('div', { style: { flex: '1 1 auto', minWidth: 100 } },
                        h('div', { style: { fontSize: 11, color: C.text2 } }, m.key + (m.port ? ' · 端口 ' + m.port : '') + (m.files && m.files.length ? ' · ' + m.files[0] : '')),
                        m.use ? h('div', { style: { fontSize: 10, color: C.text3 } }, m.use) : null,
                        h('div', { style: { fontSize: 10, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: m.modelsDir }, m.modelsDir)),
                      h('span', { style: { fontSize: 10, color: C.text3 } }, fmtBytes(m.bytes)),
                      h(Btn, { onClick: () => act('openPluginDir', { name: plugin.name, path: m.modelsDir }), style: { padding: '0 6px', fontSize: 11 } }, '打开')
                    ))
                  )
                  : null
              );
            }),

            newOpen
              ? h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' } },
                h('select', {
                  className: 'sc-input', value: newParent,
                  onChange: (e) => setNewParent(e.target.value),
                  style: { padding: '3px 6px', fontSize: 12, maxWidth: 150 },
                }, (struct.parents || []).map((p) => h('option', { key: p.path, value: p.path }, p.label))),
                h('input', {
                  className: 'sc-input', placeholder: 'KEY', spellCheck: false, value: newKey,
                  onChange: (e) => setNewKey(e.target.value),
                  style: { width: 130, padding: '3px 6px', fontSize: 12 },
                }),
                h('input', {
                  className: 'sc-input', placeholder: '值', spellCheck: false, value: newVal,
                  onChange: (e) => setNewVal(e.target.value),
                  style: { flex: 1, minWidth: 90, padding: '3px 6px', fontSize: 12 },
                }),
                h(Btn, { kind: 'primary', onClick: addField, disabled: structBusy, style: { padding: '2px 8px' } }, '添加'),
                h(Btn, { onClick: () => { setNewOpen(false); setNewKey(''); setNewVal(''); }, style: { padding: '2px 8px' } }, '取消')
              )
              : structSource === 'profile'
                ? null
                : h(Btn, { onClick: () => { setNewOpen(true); setNewParent(''); }, style: { marginTop: 8, padding: '2px 8px' } }, h(Icon, { name: 'plus', size: 12 }), '添加一条'),
            h('div', { style: { fontSize: 11, color: C.text3, marginTop: 6 } },
              structSource === 'profile'
                ? '改的是 profile 的 cordis.patch.yml，保存时先备份成 cordis.patch.yml.bak-skill-center；改完重启 DSH 生效。'
                : '改的是 ' + struct.file + '，保存时先备份成 .bak-skill-center。')
          )
          : null,

        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 5px' } },
          h('span', { style: { color: C.text3, fontSize: 11, flex: 1 } }, '配置'),
          h(Btn, { onClick: () => act('openPluginDir', { name: plugin.name, path: structPath || (struct && struct.configDir) || '' }), style: { padding: '1px 8px' } }, '打开所在文件夹')
        ),
        plugin.hasConfigCard === true
          ? h('div', {
            style: { fontSize: 12, color: C.text2, lineHeight: '18px', background: C.l1, border: '1px solid ' + C.border, borderRadius: 8, padding: '8px 10px' },
          }, '这个插件在「插件」页有自己的配置卡片（key 就是包名），它自己的设置要去那里改；下面改的是它的普通文件。')
          : h('div', { style: { fontSize: 12, color: C.text3 } },
            plugin.hasConfigCard === null ? '内置插件，不扫描它的客户端代码。' : '这个插件没有注册配置卡片。'),

        plugin.configs && plugin.configs.length
          ? h('div', { style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 } },
            plugin.configs.map((file) => h('div', {
              key: file.path || file.name, style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 },
            },
              h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: file.path || file.name }, file.name),
              file.where ? h(Tag, null, file.where) : null,
              h('span', { style: { color: C.text3, fontSize: 11, flex: '0 0 auto' } }, fmtBytes(file.bytes)),
              h(Btn, { onClick: () => openFile(file), disabled: cfgBusy, style: { padding: '2px 8px' } }, '编辑')
            )))
          : h('div', { style: { marginTop: 6, fontSize: 12, color: C.text3 } },
            plugin.profileConfigId ? '它的设置在上面「模型 / 地址 / 密钥」里直接改（profile 的 cordis.patch.yml）。' : '这个插件没有可编辑的配置文件（插件目录和它的数据目录里都没找到）。'),

        editing ? h('div', { style: { marginTop: 10 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
            h('span', { style: { fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: editing.path }, '编辑 ' + editing.name),
            h(Btn, { onClick: saveFile, kind: 'primary', disabled: cfgBusy }, cfgBusy ? '保存中…' : '保存'),
            h(Btn, { onClick: () => setEditing(''), disabled: cfgBusy }, '取消')
          ),
          h('textarea', {
            className: 'sc-area', value: text, spellCheck: false,
            onChange: (e) => setText(e.target.value),
            style: {
              width: '100%', height: 190, padding: '8px 10px', fontSize: 12, lineHeight: '17px',
              fontFamily: 'ui-monospace, Consolas, monospace', resize: 'vertical',
            },
          }),
          h('div', { style: { fontSize: 11, color: C.text3, marginTop: 4 } }, '保存时原文件会备份成 .bak-skill-center。')
        ) : null,

        label('操作'),
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          h(Btn, {
            onClick: onToggle,
            kind: plugin.enabled ? undefined : 'primary',
            disabled: busy || (plugin.self && plugin.enabled),
            title: plugin.self && plugin.enabled ? '不能停用当前插件，页面会跟着消失' : '',
          }, busy ? '处理中…' : plugin.enabled ? '停用' : '启用'),
          h(Btn, { onClick: () => act('openPluginFolder', { name: plugin.name }) }, '打开目录'),
          h(Btn, {
            onClick: async () => {
              const ok = await copyText(plugin.name);
              say(ok ? '已复制插件名' : '复制失败', ok ? 'ok' : 'err');
            },
          }, '复制名字')
        )
      );
    }

    function Plugins({ say, reloadRef }) {
      const [list, setList] = useState(null);
      const [err, setErr] = useState('');
      const [q, setQ] = useState('');
      const [showAll, setShowAll] = useState(false);
      const [sel, setSel] = useState('');
      const [busyName, setBusyName] = useState('');
      const [view, setView] = useState('card');

      const load = useCallback(async () => {
        try {
          const body = await callAction('plugins');
          setList(body.plugins || []);
          setErr('');
        } catch (e) {
          setErr(String((e && e.message) || e));
        }
      }, []);

      useEffect(() => { load(); }, [load]);
      useEffect(() => {
        if (reloadRef) reloadRef.current = load;
        return () => {
          if (reloadRef) reloadRef.current = null;
        };
      }, [load, reloadRef]);

      const all = list || [];
      const mine = all.filter((plugin) => plugin.availability === 'profile');
      const filtered = useMemo(() => {
        const key = q.trim().toLowerCase();
        return all.filter((plugin) => {
          if (!showAll && plugin.availability !== 'profile') return false;
          if (!key) return true;
          return ((plugin.displayName || '') + ' ' + plugin.name + ' ' + plugin.description + ' ' + plugin.source + ' ' + plugin.version).toLowerCase().includes(key);
        });
      }, [all, q, showAll]);

      const selected = all.find((plugin) => plugin.name === sel) || null;

      useEffect(() => {
        if (selected && !filtered.some((plugin) => plugin.name === selected.name)) setSel('');
      }, [filtered, selected]);

      async function toggle(plugin) {
        setBusyName(plugin.name);
        try {
          const body = await callAction('setPluginEnabled', { name: plugin.name, enabled: !plugin.enabled });
          if (body.message) say(body.message, 'ok');
          await load();
        } catch (e) {
          say(String((e && e.message) || e), 'err');
        } finally {
          setBusyName('');
        }
      }

      async function remove(plugin) {
        setBusyName(plugin.name);
        try {
          const body = await callAction('deletePlugin', { name: plugin.name });
          if (body.message) say(body.message, 'ok');
          if (sel === plugin.name) setSel('');
          await load();
        } catch (e) {
          say(String((e && e.message) || e), 'err');
        } finally {
          setBusyName('');
        }
      }

      return h('div', { style: { display: 'flex', flex: 1, minHeight: 0 } },
        h('section', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
          h('div', {
            style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + C.border, flexWrap: 'wrap' },
          },
            h('input', {
              className: 'sc-input', value: q, placeholder: '搜插件名 / 说明 / 来源…',
              onChange: (e) => setQ(e.target.value),
              style: { flex: 1, minWidth: 140, padding: '6px 10px', fontSize: 13 },
            }),
            h('button', {
              type: 'button', className: 'sc-row', onClick: () => setShowAll(!showAll),
              style: {
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
                border: '1px solid ' + C.border, background: 'transparent', cursor: 'pointer',
                color: showAll ? C.text : C.text2, fontSize: 12, fontFamily: 'inherit',
              },
            }, h(CheckBox, { checked: showAll }), '含 DSH 自带'),
            h('div', { style: { display: 'inline-flex', border: '1px solid ' + C.border, borderRadius: 8, overflow: 'hidden' } },
              ['card', 'list'].map((one) => h('button', {
                key: one, type: 'button', className: 'sc-row',
                onClick: () => setView(one),
                title: one === 'card' ? '卡片' : '列表',
                style: {
                  padding: '5px 9px', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                  background: view === one ? C.l3 : 'transparent', color: view === one ? C.text : C.text3,
                },
              }, one === 'card' ? '卡片' : '列表'))
            ),
            h('span', { style: { color: C.text3, fontSize: 12, whiteSpace: 'nowrap' } },
              mine.filter((plugin) => plugin.enabled).length + ' 个启用 / ' + mine.length + ' 个自己装的')
          ),

          err ? h('div', { style: { padding: '12px 14px', color: C.err, fontSize: 12, wordBreak: 'break-all' } }, '读不到插件清单：' + err) : null,

          !list && !err
            ? h('div', { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 } }, '正在读插件清单…')
            : null,

          h('div', { className: 'sc-scroll', style: { flex: 1, padding: '10px 12px 24px' } },
            filtered.length === 0
              ? h('div', { style: { padding: '40px 0', textAlign: 'center', color: C.text3 } }, list ? '没有匹配的插件' : '')
              : view === 'card'
                ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(228px, 1fr))', gap: 8, alignItems: 'stretch' } },
                  filtered.map((plugin) => h(PluginCard, {
                    key: plugin.name, plugin, on: sel === plugin.name, onClick: () => setSel(plugin.name),
                    onDelete: () => remove(plugin),
                  })))
                : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  filtered.map((plugin) => h(PluginRow, {
                    key: plugin.name, plugin, on: sel === plugin.name, onClick: () => setSel(plugin.name),
                    onDelete: () => remove(plugin),
                  })))
          )
        ),

        h('aside', {
          className: 'sc-scroll sc-detail' + (selected ? '' : ' sc-detail-empty'),
          style: { width: 344, flex: '0 0 auto', borderLeft: '1px solid ' + C.border, padding: 14 },
        },
          selected
            ? h(PluginDetail, {
              plugin: selected, say, key: selected.name,
              onClose: () => setSel(''), onToggle: () => toggle(selected), busy: busyName === selected.name,
              onSaved: () => { load(); },
            })
            : h('div', { style: { color: C.text3, fontSize: 13, paddingTop: 24, lineHeight: '20px' } },
              '左边选一个插件看详情：开关、它挂了哪些条目、有没有配置卡片、能改的配置文件。',
              h('br'),
              '新装或停用的插件，点「刷新列表」就出来了。')
        )
      );
    }

    /* ---------------------------------------------------------------- 技能库页 */

    function Library({ model, categories, filtered, category, setCategory, query, setQuery, selected, setSelectedId, run, busy, say, inputActions }) {
      const total = model.skills.length;
      const groups = [
        { title: '按应用 / 必须一起用', kind: 'app' },
        { title: '按类型', kind: 'type' },
        { title: '我的分类', kind: 'user' },
        { title: '未归类', kind: 'none' },
      ];
      const [adding, setAdding] = useState(null); // null = 收起，字符串 = 输入中的新分类名
      const [renaming, setRenaming] = useState(null); // { key, text }
      const [picking, setPicking] = useState(''); // 正在往哪个分类里加 skill
      const [pickQ, setPickQ] = useState('');
      const [selIds, setSelIds] = useState([]); // 多选的 skill id
      const [bulkCat, setBulkCat] = useState(''); // 多选后要加进的分类
      const [confirmDel, setConfirmDel] = useState(''); // 待二次确认删除的分类 key

      const toggleSel = (id) => setSelIds((prev) => (prev.indexOf(id) >= 0 ? prev.filter((x) => x !== id) : prev.concat([id])));
      const selSkills = model.skills.filter((skill) => selIds.indexOf(skill.id) >= 0);

      const removeSkill = async (skill) => {
        const body = await run('deleteSkill', { id: skill.id });
        if (body && body.ok !== false) {
          if (selected && selected.id === skill.id) setSelectedId('');
          setSelIds((prev) => prev.filter((x) => x !== skill.id));
        }
      };

      const skillsOf = (key) => (key === 'all'
        ? model.skills
        : model.skills.filter((skill) => skill.categoryKey === key));
      const sendGroup = (label, key) => {
        const list = skillsOf(key);
        if (list.length === 0) { say('这个分类里还没有 skill'); return; }
        sendToComposer(inputActions, list.map((skill) => '/' + skill.name + ' ').join(''), say);
      };

      const catRow = (key, label, count, opts) => {
        const editable = !!(opts && opts.editable);
        const addable = !!(opts && opts.addable);
        const isRenaming = renaming && renaming.key === key;
        const isPicking = picking === key;
        const row = h('div', {
          key: 'row', style: { display: 'flex', alignItems: 'center', gap: 2, marginBottom: 1 },
        },
          isRenaming
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flex: 1, padding: '2px 4px' } },
              h('input', {
                className: 'sc-input', value: renaming.text, autoFocus: true,
                onChange: (e) => setRenaming({ key, text: e.target.value }),
                onKeyDown: async (e) => {
                  if (e.key === 'Escape') setRenaming(null);
                  if (e.key === 'Enter') {
                    const text = renaming.text.trim();
                    if (text && text !== label) await run('renameCategory', { key, label: text });
                    setRenaming(null);
                  }
                },
                style: { flex: 1, padding: '3px 7px', fontSize: 12 },
              }),
              h(Btn, {
                style: { padding: '2px 8px' },
                onClick: async () => {
                  const text = renaming.text.trim();
                  if (text && text !== label) await run('renameCategory', { key, label: text });
                  setRenaming(null);
                },
              }, '确定'),
              h(Btn, { style: { padding: '2px 8px' }, onClick: () => setRenaming(null) }, '取消'))
            : h('button', {
              type: 'button', className: 'sc-row',
              onClick: () => setCategory(key),
              onDoubleClick: () => { if (editable) setRenaming({ key, text: label }); },
              title: editable ? '双击改名' : undefined,
              style: {
                display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, textAlign: 'left',
                padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: category === key ? C.l3 : 'transparent',
                color: category === key ? C.text : C.text2, fontSize: 13, fontFamily: 'inherit',
              },
            }, h('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
              h('span', { style: { color: C.text3, fontSize: 11 } }, String(count))),
          editable && !isRenaming ? h('button', {
            type: 'button', className: 'sc-send-mini', title: '改这个分类的名字',
            onClick: () => setRenaming({ key, text: label }),
          }, h(Icon, { name: 'edit', size: 12 })) : null,
          editable && !isRenaming ? h('button', {
            type: 'button', className: 'sc-send-mini',
            title: confirmDel === key ? '再点一次就删掉这个分类' : '删除这个分类（里面的 skill 会回到自动归类）',
            style: confirmDel === key ? { color: C.err, opacity: 1 } : undefined,
            onClick: async () => {
              if (confirmDel === key) {
                setConfirmDel('');
                const body = await run('deleteCategory', { key });
                if (category === key) setCategory('all');
                say('已删除分类「' + label + '」');
              } else {
                setConfirmDel(key);
                say('再点一次叉号就删掉「' + label + '」，里面的 skill 会回到自动归类');
              }
            },
          }, confirmDel === key ? '确认删除' : h(Icon, { name: 'close', size: 12 })) : null,
          addable && !isRenaming ? h('button', {
            type: 'button', className: 'sc-send-mini',
            title: selIds.length > 0
              ? '把选中的 ' + selIds.length + ' 个 skill 加进这个分类'
              : '把 skill 加进这个分类（先勾选卡片可以一次加多个）',
            onClick: async () => {
              if (selIds.length > 0) {
                const ids = selIds.slice();
                await run('assignMany', { ids, categoryKey: key });
                say('已把选中的 ' + ids.length + ' 个 skill 加进「' + label + '」');
                setSelIds([]); setPicking('');
                return;
              }
              setPicking(isPicking ? '' : key); setPickQ('');
            },
          }, isPicking ? h(Icon, { name: 'close', size: 11 }) : h(Icon, { name: 'plus', size: 11 })) : null,
          !isRenaming ? h('button', {
            type: 'button', className: 'sc-send-mini', title: '把这个分类里的 skill 都送进对话（写 /名字）',
            onClick: () => sendGroup(label, key),
          }, h(Icon, { name: 'send', size: 12 })) : null
        );
        const picker = isPicking ? h('div', {
          key: 'pick',
          style: { margin: '2px 4px 6px', padding: '6px 6px 4px', borderRadius: 6, background: C.l2, border: '1px solid ' + C.border },
        },
          h('input', {
            className: 'sc-input', value: pickQ, autoFocus: true,
            placeholder: '搜 skill，点一下加进「' + label + '」',
            onChange: (e) => setPickQ(String(e.target.value || '').toLowerCase()),
            style: { width: '100%', padding: '4px 7px', fontSize: 12, boxSizing: 'border-box', marginBottom: 4 },
          }),
          h('div', { className: 'sc-scroll', style: { maxHeight: 168, overflow: 'auto' } },
            model.skills
              .filter((skill) => skill.categoryKey !== key)
              .filter((skill) => !pickQ || String(skill.name + ' ' + (skill.displayName || '') + ' ' + (skill.summary || '')).toLowerCase().includes(pickQ))
              .slice(0, 60)
              .map((skill) => h('button', {
                key: skill.id, type: 'button', className: 'sc-row',
                onClick: async () => { await run('assign', { id: skill.id, categoryKey: key }); },
                title: '加进「' + label + '」',
                style: {
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '4px 6px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: C.text2, fontSize: 12, fontFamily: 'inherit',
                },
              }, h('span', { style: { color: C.brand } }, h(Icon, { name: 'plus', size: 12, stroke: 2 })),
                h('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.displayName || skill.name))),
            model.skills.filter((skill) => skill.categoryKey === key).length === 0 && !pickQ
              ? h('div', { style: { color: C.text3, fontSize: 11, padding: '6px 4px' } }, '这个分类还是空的，上面点一个 skill 就加进来。')
              : null
          )
        ) : null;
        return h('div', { key }, row, picker);
      };

      return h('div', { style: { display: 'flex', flex: 1, minHeight: 0 } },
        h('aside', {
          className: 'sc-scroll sc-cat',
          style: { width: 214, flex: '0 0 auto', borderRight: '1px solid ' + C.border, padding: '10px 8px' },
        },
          catRow('all', '全部', total),
          groups.map((group) => {
            const list = categories.filter((item) => item.kind === group.kind);
            if (list.length === 0) return null;
            return h('div', { key: group.kind, style: { marginTop: 12 } },
              h('div', { style: { padding: '0 8px 4px', color: C.text3, fontSize: 11, letterSpacing: 0 } }, group.title),
              list.map((item) => catRow(item.key, item.label, item.count, { editable: group.kind === 'user', addable: true }))
            );
          }),
          h('div', { style: { marginTop: 14, padding: '0 8px' } },
            adding === null
              ? h(Btn, {
                style: { width: '100%', justifyContent: 'center' },
                onClick: () => setAdding(''),
              }, h(Icon, { name: 'plus', size: 12 }), '新建分类')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('input', {
                  className: 'sc-input', value: adding, autoFocus: true,
                  placeholder: '新分类的名字，回车确定',
                  onChange: (e) => setAdding(e.target.value),
                  onKeyDown: async (e) => {
                    if (e.key === 'Escape') setAdding(null);
                    if (e.key === 'Enter') {
                      const label = adding.trim();
                      if (!label) return;
                      const body = await run('createCategory', { label });
                      setAdding(null);
                      const cats = ((body && (body.value || body) && (body.value || body).categories) || []).filter((c) => c.kind === 'user');
                      if (cats.length) setCategory(cats[cats.length - 1].key);
                    }
                  },
                  style: { width: '100%', padding: '6px 9px', fontSize: 13, boxSizing: 'border-box' },
                }),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h(Btn, {
                    kind: 'primary', style: { flex: 1, justifyContent: 'center' },
                    onClick: async () => {
                      const label = adding.trim();
                      if (!label) return;
                      const body = await run('createCategory', { label });
                      setAdding(null);
                      const cats = ((body && (body.value || body) && (body.value || body).categories) || []).filter((c) => c.kind === 'user');
                      if (cats.length) setCategory(cats[cats.length - 1].key);
                    },
                  }, '新建'),
                  h(Btn, { style: { flex: 1, justifyContent: 'center' }, onClick: () => setAdding(null) }, '取消')))
          )
        ),

        h('section', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
          h('div', {
            style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + C.border },
          },
            h('input', {
              className: 'sc-input', value: query, placeholder: '搜名称 / 说明 / 路径 / 应用…',
              onChange: (e) => setQuery(e.target.value),
              style: { flex: 1, padding: '6px 10px', fontSize: 13 },
            }),
            h('select', {
              className: 'sc-input sc-cat-select', value: category,
              onChange: (e) => setCategory(e.target.value),
              style: { padding: '6px 8px', fontSize: 12, maxWidth: 150 },
            },
              h('option', { value: 'all' }, '全部分类（' + total + '）'),
              categories.map((item) => h('option', { key: item.key, value: item.key }, item.label + '（' + item.count + '）'))
            ),
            h('span', { style: { color: C.text3, fontSize: 12, whiteSpace: 'nowrap' } }, filtered.length + ' / ' + total)
          ),
          selSkills.length > 0 ? h('div', {
            style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: '1px solid ' + C.border, background: C.l2, flexWrap: 'wrap' },
          },
            h('span', { style: { fontSize: 12, color: C.text2 } }, '已选 ' + selSkills.length + ' 个'),
            h('span', { style: { fontSize: 12, color: C.text3 } }, '（也可以直接点左边某个分类行的加号加进去）'),
            h(Btn, {
              kind: 'primary', style: { padding: '3px 10px' },
              onClick: () => sendToComposer(inputActions, selSkills.map((skill) => '/' + skill.name + ' ').join(''), say),
            }, '发送到对话'),
            h('select', {
              className: 'sc-input', value: bulkCat,
              onChange: (e) => setBulkCat(e.target.value),
              style: { padding: '3px 6px', fontSize: 12, maxWidth: 170 },
            },
              h('option', { value: '' }, '加入分类…'),
              categories.map((item) => h('option', { key: item.key, value: item.key }, item.label))
            ),
            h(Btn, {
              style: { padding: '3px 10px' }, disabled: !bulkCat,
              onClick: async () => {
                if (!bulkCat) return;
                const target = categories.find((item) => item.key === bulkCat) || {};
                const ids = selIds.slice();
                await run('assignMany', { ids, categoryKey: bulkCat });
                say('已把 ' + ids.length + ' 个 skill 加进「' + (target.label || bulkCat) + '」');
                setSelIds([]); setBulkCat('');
              },
            }, '加入'),
            h(Btn, { style: { padding: '3px 10px' }, onClick: () => { setSelIds([]); setBulkCat(''); } }, '清空选择')
          ) : null,
          h('div', { className: 'sc-scroll', style: { flex: 1, padding: '10px 12px 24px' } },
            filtered.length === 0
              ? h('div', { style: { padding: '40px 0', textAlign: 'center', color: C.text3 } },
                category !== 'all' && category !== '__none__' && !query
                  ? '这个分类还是空的。点左边分类行上的加号，把 skill 加进来。'
                  : '这一类里没有 skill')
              : h('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(214px, 1fr))',
                  gap: 8, alignItems: 'stretch',
                },
              }, filtered.map((skill) => h(SkillCard, {
                key: skill.id, skill, on: selected && selected.id === skill.id,
                onClick: () => setSelectedId(skill.id),
                onSend: () => sendToComposer(inputActions, '/' + skill.name + ' ', say),
                checked: selIds.indexOf(skill.id) >= 0,
                onCheck: () => toggleSel(skill.id),
                onDelete: () => removeSkill(skill),
              })))
          )
        ),

        h('aside', {
          className: 'sc-scroll sc-detail' + (selected ? '' : ' sc-detail-empty'),
          style: { width: 344, flex: '0 0 auto', borderLeft: '1px solid ' + C.border, padding: 14 },
        },
          selected
            ? h(SkillDetail, { skill: selected, model, categories, run, busy, say, inputActions, key: selected.id, onClose: () => setSelectedId('') })
            : h('div', { style: { color: C.text3, fontSize: 13, paddingTop: 24, lineHeight: '20px' } },
              '左边选一个 skill 看详情。',
              h('br'),
              '每个 skill 的「它是干什么的」优先用内置的中文说明，随时可以改成你自己的说法。')
        )
      );
    }

    /** 一张小卡片：名字 + 一句话说明 + 一行元信息，点开在右栏看详情。 */
    function SkillCard({ skill, on, onClick, onSend, checked, onCheck, onDelete }) {
      const meta = [
        skill.app,
        skill.files + ' 个文件',
        fmtBytes(skill.bytes),
      ];
      if (skill.references) meta.push('references');
      if (skill.scripts) meta.push('scripts');
      if ((skill.alsoAt || []).length) meta.push('另有 ' + skill.alsoAt.length + ' 处');

      return h('div', {
        className: 'sc-card' + (on ? ' on' : ''),
        onClick,
        title: skill.summary || skill.name,
        style: {
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 5,
          padding: '9px 11px 8px', borderRadius: 10, cursor: 'pointer',
          border: '1px solid ' + (on ? C.border3 : C.border),
          background: on ? C.l2 : C.l1,
          minHeight: 92, overflow: 'hidden',
        },
      },
        onDelete ? h(DelBtn, { onDelete, floating: true, title: '从本地删除这个 skill' }) : null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
          h('span', {
            key: 'ck', style: { flex: '0 0 auto', display: 'flex' },
            onClick: (event) => { event.stopPropagation(); if (onCheck) onCheck(); },
            title: checked ? '取消选择' : '选中（可多选后一起发送 / 加入分类）',
          }, h(CheckBox, { checked: !!checked })),
          h('span', {
            style: { flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          }, skill.displayName || skill.name),
          skill.adopted ? h(Tag, { tone: 'ok' }, '托管') : null,
          skill.kind === 'file' ? h(Tag, null, '单文件') : null
        ),
        h('div', {
          style: {
            color: C.text2, fontSize: 12, lineHeight: '17px',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          },
        }, skill.summary || '（这个 skill 没写 description）'),
        h('div', { style: { flex: 1 } }),
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 6, color: C.text3, fontSize: 11,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          },
        },
          h('span', { style: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, meta.join(' · ')),
          h('span', { style: { flex: '0 0 auto', opacity: .85 } }, skill.summarySource === 'user' ? '手写' : ''),
          onSend ? h('button', {
            type: 'button', className: 'sc-send-mini', title: '把这个 skill 送进对话输入框',
            onClick: (event) => { event.stopPropagation(); onSend(); },
          }, h(Icon, { name: 'send', size: 12 })) : null
        )
      );
    }

    function SkillDetail({ skill, model, categories, run, busy, say, onClose, inputActions }) {
      const [draft, setDraft] = useState(skill.summary || '');
      const [note, setNote] = useState('');
      const [editing, setEditing] = useState('');
      const [text, setText] = useState('');
      const [cfgBusy, setCfgBusy] = useState(false);
      const [envEditing, setEnvEditing] = useState('');
      const [envValue, setEnvValue] = useState('');
      const [envBusy, setEnvBusy] = useState(false);
      const [envDeleting, setEnvDeleting] = useState('');
      const [newName, setNewName] = useState('');
      const [newValue, setNewValue] = useState('');
      const [showNew, setShowNew] = useState(false);
      const [nameEditing, setNameEditing] = useState(false);
      const [nameDraft, setNameDraft] = useState('');
      const [nameBusy, setNameBusy] = useState(false);

      async function saveSkillName(reset) {
        setNameBusy(true);
        try {
          await run(reset ? 'resetName' : 'setName', reset ? { id: skill.id } : { id: skill.id, text: nameDraft });
          setNameEditing(false);
          setNameDraft('');
        } finally {
          setNameBusy(false);
        }
      }

      /* 模型 / API：直接在这个 skill 的详情里改，改的是它自己的 .env */
      const guessed = guessModelNames(skill);
      const [modelBase, setModelBase] = useState('');
      const [modelName, setModelName] = useState('');
      const [modelKey, setModelKey] = useState('');
      const [nameBase, setNameBase] = useState(guessed.base);
      const [nameModel, setNameModel] = useState(guessed.model);
      const [nameKey, setNameKey] = useState(guessed.key);
      const [modelBusy, setModelBusy] = useState(false);
      const [modelResult, setModelResult] = useState(null);

      const testModel = async () => {
        setModelBusy(true);
        setModelResult(null);
        try {
          const body = await callAction('testEndpoint', {
            baseURL: modelBase,
            model: modelName,
            apiKey: modelKey,
            apiKeyEnv: nameKey,
          });
          setModelResult(body.test || { ok: false, reachable: false, detail: '没有结果' });
        } catch (error) {
          setModelResult({ ok: false, reachable: false, detail: String((error && error.message) || error) });
        } finally {
          setModelBusy(false);
        }
      };

      const saveModelEnv = async () => {
        setModelBusy(true);
        try {
          const entries = [
            { name: nameBase, value: modelBase },
            { name: nameModel, value: modelName },
            { name: nameKey, value: modelKey },
          ].filter((entry) => String(entry.value || '').trim() !== '');
          if (entries.length === 0) throw new Error('先填服务地址 / 模型 / key 中的至少一项');
          const body = await callAction('writeEnvMany', { id: skill.id, entries });
          say(body.message || '已写入 .env');
          await run('rescan');
        } catch (error) {
          say(String((error && error.message) || error), 'err');
        } finally {
          setModelBusy(false);
        }
      };

      const saveEnv = async () => {
        setEnvBusy(true);
        try {
          const body = await callAction('writeEnv', { id: skill.id, name: envEditing, value: envValue });
          say(body.message || '已写入 .env');
          setEnvEditing('');
          setEnvValue('');
          await run('rescan');
        } catch (error) {
          say(String((error && error.message) || error), 'err');
        } finally {
          setEnvBusy(false);
        }
      };

      /** 从 .env 里删掉这一行（值置空 = 删除该行，宿主的 writeEnvMany 就是这么实现的）。 */
      const deleteEnv = async (name) => {
        setEnvDeleting(name);
        try {
          const body = await callAction('writeEnvMany', { id: skill.id, entries: [{ name, value: '' }] });
          say(body.message || ('已从 .env 删掉 ' + name));
          await run('rescan');
        } catch (error) {
          say(String((error && error.message) || error), 'err');
        } finally {
          setEnvDeleting('');
        }
      };

      /** 手动加一条 SKILL.md 没提到的变量。 */
      const addEnv = async () => {
        setEnvBusy(true);
        try {
          const name = String(newName || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
          if (!name) throw new Error('先填变量名（大写字母、数字、下划线）');
          const body = await callAction('writeEnvMany', { id: skill.id, entries: [{ name, value: newValue }] });
          say(body.message || ('已写入 .env：' + name));
          setNewName('');
          setNewValue('');
          setShowNew(false);
          await run('rescan');
        } catch (error) {
          say(String((error && error.message) || error), 'err');
        } finally {
          setEnvBusy(false);
        }
      };

      /** 本地模型预设：填地址、清掉 key（本地端点一般不需要 key）。 */
      const useLocal = (base) => {
        setModelBase(base);
        setModelName('');
        setModelKey('');
        setModelResult(null);
      };

      /** 一行 = 标签 + 值 + 「存成哪个变量」。 */
      const modelRow = (label, value, setValue, name, setName, placeholder, type) =>
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          h('span', { style: { flex: '0 0 52px', color: C.text3, fontSize: 11 } }, label),
          h('input', {
            className: 'sc-input', type: type || 'text', value,
            placeholder,
            onChange: (e) => setValue(e.target.value),
            style: { flex: 1, minWidth: 0, padding: '4px 7px', fontSize: 12, boxSizing: 'border-box' },
          }),
          h('input', {
            className: 'sc-input', type: 'text', value: name, title: '存成哪个环境变量',
            onChange: (e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')),
            style: {
              flex: '0 0 118px', padding: '4px 6px', fontSize: 10,
              fontFamily: 'ui-monospace, Consolas, monospace', boxSizing: 'border-box',
            },
          })
        );

      const modelTone = modelResult ? (modelResult.ok ? C.ok : modelResult.reachable ? C.warn : C.err) : C.text3;
      const modelLine = modelResult
        ? (modelResult.ok ? '通' : modelResult.reachable ? '地址通，但没调通' : '连不上')
          + (modelResult.ms !== undefined ? ' · ' + modelResult.ms + 'ms' : '')
          + (modelResult.status ? ' · HTTP ' + modelResult.status : '')
          + (modelResult.detail ? ' · ' + modelResult.detail : '')
        : '';

      const openFile = async (name) => {
        setCfgBusy(true);
        try {
          const body = await callAction('readConfig', { id: skill.id, name });
          setText((body.config && body.config.text) || '');
          setEditing(name);
        } catch (error) {
          say(String((error && error.message) || error), 'err');
        } finally {
          setCfgBusy(false);
        }
      };

      const saveFile = async () => {
        setCfgBusy(true);
        try {
          await callAction('writeConfig', { id: skill.id, name: editing, text });
          say('已保存 ' + editing);
          setEditing('');
          await run('rescan');
        } catch (error) {
          say(String((error && error.message) || error), 'err');
        } finally {
          setCfgBusy(false);
        }
      };

      useEffect(() => { setDraft(skill.summary || ''); }, [skill.id, skill.summary]);

      const dirty = draft !== (skill.summary || '');
      const inCombo = (combo) => (combo.items || []).includes(skill.id);

      const section = (title, children, extra) => h('div', { style: { marginTop: 16 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
          h('div', { style: { color: C.text3, fontSize: 11, letterSpacing: 0 } }, title),
          h('div', { style: { flex: 1 } }),
          extra || null
        ),
        children
      );

      return h('div', null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          nameEditing
            ? h('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', flex: '1 1 auto' } },
              h('input', {
                className: 'sc-input', value: nameDraft, spellCheck: false, placeholder: '给它起个好认的名字',
                onChange: (e) => setNameDraft(e.target.value),
                style: { flex: '1 1 140px', minWidth: 0, padding: '3px 6px', fontSize: 13 },
              }),
              h(Btn, { kind: 'primary', onClick: () => saveSkillName(false), disabled: nameBusy, style: { padding: '2px 8px' } }, '保存'),
              h(Btn, { onClick: () => { setNameEditing(false); setNameDraft(''); }, disabled: nameBusy, style: { padding: '2px 8px' } }, '取消'),
              skill.nameSource === 'user' ? h(Btn, { onClick: () => saveSkillName(true), disabled: nameBusy, style: { padding: '2px 8px' } }, '恢复原名') : null
            )
            : [
              h('strong', { key: 'n', style: { fontSize: 15 } }, skill.displayName || skill.name),
              skill.nameSource === 'user' ? hTag('改过名', '只在这里显示；SKILL.md 里的 name 没动') : null,
              h(Btn, { key: 'e', onClick: () => { setNameDraft(skill.displayName || skill.name); setNameEditing(true); }, style: { padding: '0 6px', fontSize: 11 } }, '改名'),
            ],
          skill.kind === 'file' ? h(Tag, null, '单文件') : h(Tag, null, '目录包'),
          h(Tag, null, skill.app),
          skill.adopted ? h(Tag, { tone: 'ok' }, '已托管到 DSH') : null,
          h('div', { style: { flex: 1 } }),
          h(Btn, {
            kind: 'primary',
            title: '把这个 skill 送进对话输入框（不会自动发出去）',
            onClick: () => sendToComposer(inputActions, '/' + skill.name + ' ', say),
          }, '发送'),
          onClose
            ? h('button', {
              type: 'button', className: 'sc-btn', title: '关掉详情',
              onClick: onClose,
              style: {
                border: '1px solid ' + C.border, background: C.l2, color: C.text2,
                borderRadius: 8, padding: '2px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              },
            }, h(Icon, { name: 'close', size: 13 }))
            : null
        ),
        h('div', {
          style: { marginTop: 6, color: C.text3, fontSize: 12, wordBreak: 'break-all', fontFamily: 'ui-monospace, Consolas, monospace', lineHeight: '17px' },
        }, skill.path),

        (skill.alsoAt || []).length
          ? h('div', {
            style: {
              marginTop: 8, padding: '7px 9px', borderRadius: 8, background: C.l1,
              border: '1px solid ' + C.border, color: C.text3, fontSize: 12, lineHeight: '18px',
            },
          },
            '同一份 skill 也装在另外 ' + skill.alsoAt.length + ' 处（同名同内容，只算一个）：',
            h('br'),
            skill.alsoAt.map((where) => h('div', {
              key: where,
              style: { wordBreak: 'break-all', fontFamily: 'ui-monospace, Consolas, monospace', color: C.text2 },
            }, '· ' + where)))
          : null,

        section('它是干什么的',
          h('textarea', {
            className: 'sc-area', value: draft, rows: 4,
            onChange: (e) => setDraft(e.target.value),
            placeholder: '用一句话说明这个 skill 什么时候该用',
            style: { width: '100%', padding: '8px 10px', fontSize: 13, lineHeight: '19px', resize: 'vertical', boxSizing: 'border-box' },
          }),
          h('div', { style: { display: 'flex', gap: 8 } },
            h(Btn, {
              kind: 'primary', disabled: busy || !dirty,
              onClick: async () => { await run('setSummary', { id: skill.id, text: draft }); },
            }, '保存'),
            h(Btn, {
              disabled: busy || !skill.summaryEdited,
              onClick: async () => { await run('resetSummary', { id: skill.id }); },
            }, '恢复自动整理'),
            h('span', { style: { color: C.text3, fontSize: 11, alignSelf: 'center' } }, summaryLabel(skill))
          )
        ),

        section('归类',
          h('select', {
            className: 'sc-input', value: skill.categorySource === 'manual' ? skill.categoryKey : '',
            onChange: (e) => run('assign', { id: skill.id, categoryKey: e.target.value }),
            style: { width: '100%', padding: '6px 8px', fontSize: 13 },
          },
            h('option', { value: '' }, '自动（' + (categories.find((c) => c.key === skill.categoryKey) || {}).label + '）'),
            categories.map((item) => h('option', { key: item.key, value: item.key }, item.label))
          )
        ),

        section('放进组合（只引用，不复制、不改上面的归类）',
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            (model.combos || []).length === 0
              ? h('div', { style: { color: C.text3, fontSize: 12 } }, '还没有组合，去「组合」页建一个')
              : model.combos.map((combo) => h('button', {
                key: combo.id, type: 'button', className: 'sc-row',
                onClick: () => run('toggleComboItem', { comboId: combo.id, id: skill.id }),
                title: inCombo(combo) ? '从组合里移除' : '放进这个组合',
                style: {
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                  cursor: 'pointer', fontSize: 13, color: C.text2, width: '100%', textAlign: 'left',
                  border: 'none', background: 'transparent', fontFamily: 'inherit',
                },
              },
                h(CheckBox, { checked: inCombo(combo) }),
                h('span', { style: { flex: 1 } }, combo.name),
                h('span', { style: { color: C.text3, fontSize: 11 } }, (combo.items || []).length + ' 个')
              ))
          )
        ),

        section('配置 / API',
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('div', {
              style: { padding: '9px 10px', background: C.l1, border: '1px solid ' + C.border, borderRadius: 8 },
            },
              h('div', { style: { color: C.text3, fontSize: 11, marginBottom: 6 } },
                '模型 / API：这个 skill 走哪个地址、用哪个模型。只缺一个 key 的 skill，只填最后一行就行。存进它自己的 .env，不动别处。'),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
                modelRow('服务地址 (Base URL)', modelBase, setModelBase, nameBase, setNameBase, 'http://127.0.0.1:11434/v1'),
                modelRow('模型名', modelName, setModelName, nameModel, setNameModel, 'qwen2.5:7b 或 gpt-4.1-mini'),
                modelRow('API 密钥', modelKey, setModelKey, nameKey, setNameKey, 'sk-…（云端才要，本地一般留空）', 'password')
              ),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 7, flexWrap: 'wrap' } },
                h('span', { style: { color: C.text3, fontSize: 11, marginRight: 2 } }, '本机模型：'),
                ['Ollama|http://127.0.0.1:11434/v1', 'LM Studio|http://127.0.0.1:1234/v1', 'llama.cpp / vLLM|http://127.0.0.1:8000/v1'].map((pair) => {
                  const parts = pair.split('|');
                  const on = modelBase === parts[1];
                  return h(Btn, {
                    key: parts[0],
                    onClick: () => useLocal(parts[1]),
                    style: on
                      ? { padding: '2px 8px', fontSize: 11, background: C.fill, color: C.onFill, borderColor: 'transparent' }
                      : { padding: '2px 8px', fontSize: 11 },
                  }, parts[0]);
                }),
                h(Btn, {
                  onClick: () => { setModelBase('https://api.openai.com/v1'); setModelResult(null); },
                  style: { padding: '2px 8px', fontSize: 11 },
                }, '云端（自定义）')
              ),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' } },
                h(Btn, { disabled: modelBusy, onClick: testModel }, '测试连通'),
                h(Btn, { kind: 'primary', disabled: modelBusy, onClick: saveModelEnv }, '存进 .env'),
                skill.kind === 'dir'
                  ? h(Btn, { onClick: () => run('openFolder', { path: skill.path }) }, '打开所在文件夹')
                  : null,
                h('span', { style: { flex: 1 } }),
                h('span', { style: { fontSize: 11, color: C.text3 } }, '本地模型不用填 key')
              ),
              modelLine
                ? h('div', { style: { marginTop: 6, fontSize: 11, lineHeight: '17px', color: modelTone, wordBreak: 'break-word' } }, modelLine)
                : null,
              (skill.kind === 'dir' ? null : h('div', { style: { marginTop: 6, fontSize: 11, color: C.warn } },
                '这个 skill 是单文件，没有目录可以放 .env。'))
            ),

            skill.kind === 'dir'
              ? h('div', {
                style: { padding: '8px 10px', background: C.l1, border: '1px solid ' + C.border, borderRadius: 8 },
              },
                h('div', { style: { color: C.text3, fontSize: 11, marginBottom: 5 } },
                  'SKILL.md 里提到的环境变量（本机是否已设置）'),
                (skill.envNames || []).length === 0
                  ? h('div', { style: { color: C.text3, fontSize: 11, marginBottom: 2 } }, 'SKILL.md 里没提到环境变量。')
                  : null,
                skill.envNames.map((item) => h('div', {
                  key: item.name,
                  style: { display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0' },
                },
                  h('div', {
                    style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: '19px' },
                  },
                    h('code', { style: { fontFamily: 'ui-monospace, Consolas, monospace', color: C.text2 } }, item.name),
                    item.extra
                      ? h('span', { style: { fontSize: 10, color: C.text3, border: '1px solid ' + C.border, borderRadius: 4, padding: '0 6px' } }, '手动')
                      : null,
                    h('span', { style: { flex: 1 } }),
                    h(Tag, { tone: item.set ? 'ok' : 'warn' },
                      item.set ? '已设置' : item.inFile ? '只写在 .env' : '未设置'),
                    h(Btn, {
                      disabled: envBusy || Boolean(envDeleting),
                      onClick: () => { setEnvEditing(item.name); setEnvValue(''); },
                    }, item.inFile ? '改 .env' : '写进 .env'),
                    item.inFile
                      ? h(Btn, {
                        disabled: envBusy || Boolean(envDeleting),
                        title: '从 .env 里删掉这一行',
                        onClick: () => deleteEnv(item.name),
                        style: { color: C.err, borderColor: C.border },
                      }, envDeleting === item.name ? '删除中…' : '删除')
                      : null
                  ),
                  envEditing === item.name
                    ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                      h('input', {
                        className: 'sc-input', type: 'text', value: envValue,
                        placeholder: '粘贴 ' + item.name + ' 的值',
                        onChange: (e) => setEnvValue(e.target.value),
                        style: { flex: 1, padding: '5px 8px', fontSize: 12, boxSizing: 'border-box' },
                      }),
                      h(Btn, { kind: 'primary', disabled: envBusy, onClick: saveEnv }, '保存'),
                      h(Btn, { disabled: envBusy, onClick: () => setEnvEditing('') }, '取消')
                    )
                    : null
                  )),
                  h('div', {
                    style: {
                      marginTop: 5, paddingTop: 6, borderTop: '1px solid ' + C.border,
                      display: 'flex', flexDirection: 'column', gap: 5,
                    },
                  },
                    showNew
                      ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
                        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                          h('input', {
                            className: 'sc-input', type: 'text', value: newName,
                            placeholder: '变量名，如 MY_API_KEY',
                            onChange: (e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')),
                            style: {
                              flex: '0 0 168px', padding: '4px 7px', fontSize: 11, boxSizing: 'border-box',
                              fontFamily: 'ui-monospace, Consolas, monospace',
                            },
                          }),
                          h('input', {
                            className: 'sc-input', type: 'text', value: newValue,
                            placeholder: '值',
                            onChange: (e) => setNewValue(e.target.value),
                            style: { flex: 1, minWidth: 0, padding: '4px 7px', fontSize: 11, boxSizing: 'border-box' },
                          })
                        ),
                        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                          h(Btn, { kind: 'primary', disabled: envBusy, onClick: addEnv }, '写进 .env'),
                          h(Btn, { disabled: envBusy, onClick: () => { setShowNew(false); setNewName(''); setNewValue(''); } }, '取消'),
                          h('span', { style: { color: C.text3, fontSize: 11 } }, 'SKILL.md 里没提到的变量也能自己加')
                        )
                      )
                      : h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                        h(Btn, { disabled: envBusy, onClick: () => setShowNew(true) }, h(Icon, { name: 'plus', size: 12 }), '添加一条'),
                        h('span', { style: { color: C.text3, fontSize: 11 } }, 'SKILL.md 里没提到的变量也能自己加')
                      )
                  )
                )
              : null,

            (skill.configs || []).length === 0
              ? h('div', { style: { color: C.text3, fontSize: 12, lineHeight: '18px' } },
                '这个 skill 目录里没有可编辑的配置文件。需要 API key 的 skill 一般在对话里问你，或者读环境变量。')
              : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                skill.configs.map((file) => h('div', {
                  key: file.name, className: 'sc-row',
                  style: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6 },
                },
                  h('span', {
                    style: { flex: 1, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12, wordBreak: 'break-all' },
                  }, file.name),
                  h('span', { style: { color: C.text3, fontSize: 11 } }, fmtBytes(file.bytes)),
                  h(Btn, { disabled: cfgBusy, onClick: () => openFile(file.name) }, '编辑')
                ))),

            editing
              ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('div', { style: { color: C.text3, fontSize: 11 } }, '正在编辑 ' + editing),
                h('textarea', {
                  className: 'sc-area', value: text, rows: 12,
                  onChange: (e) => setText(e.target.value),
                  style: {
                    width: '100%', padding: '8px 10px', fontSize: 12, lineHeight: '18px', resize: 'vertical',
                    fontFamily: 'ui-monospace, Consolas, monospace', boxSizing: 'border-box',
                  },
                }),
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                  h(Btn, { kind: 'primary', disabled: cfgBusy, onClick: saveFile }, '保存'),
                  h(Btn, { disabled: cfgBusy, onClick: () => setEditing('') }, '取消'),
                  h('span', { style: { color: C.text3, fontSize: 11 } }, '保存时原文件会备份成 .bak')
                ))
              : null
          )
        ),

        section('原始 description',
          h('div', {
            style: {
              color: C.text2, fontSize: 12, lineHeight: '19px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 160, overflow: 'auto', padding: '8px 10px', background: C.l1, borderRadius: 8,
              border: '1px solid ' + C.border,
            },
          }, skill.description || '（没写 description）')
        ),

        section('SKILL.md 开头',
          h('pre', {
            style: {
              margin: 0, padding: '8px 10px', background: C.l1, borderRadius: 8, border: '1px solid ' + C.border,
              color: C.text2, fontSize: 12, lineHeight: '17px', maxHeight: 220, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'ui-monospace, Consolas, monospace',
            },
          }, skill.excerpt || '')
        ),

        section('操作',
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h(Btn, { onClick: () => run('openFolder', { path: skill.kind === 'dir' ? skill.path : skill.entry }) }, '打开所在目录'),
            skill.kind === 'dir' && !skill.inDshRoot && !skill.link
              ? h(Btn, {
                disabled: busy,
                title: '把目录挪进 DSH 技能库，原位置留一个链接，原来那个应用照旧能读到',
                onClick: () => {
                  if (window.confirm('把「' + skill.name + '」移动到 ' + model.dshSkillRoot + '，并在原位置留一个链接？\n原来的应用仍能照常读到它。')) {
                    run('adopt', { id: skill.id });
                  }
                },
              }, '托管到 DSH')
              : null,
            skill.adopted
              ? h(Btn, {
                kind: 'danger', disabled: busy,
                onClick: () => {
                  if (window.confirm('把这个 skill 挪回原位：' + skill.adoptedFrom + '？')) run('restore', { name: skill.folder });
                },
              }, '还回原位')
              : null
          ),
          skill.adopted && skill.adoptedFrom
            ? h('div', { style: { marginTop: 8, color: C.text3, fontSize: 12, wordBreak: 'break-all' } }, '原位置：' + skill.adoptedFrom)
            : null
        )
      );
    }

    /* ------------------------------------------------------------------ 组合页 */

    function Combos({ model, combos, skills, run, busy, say, inputActions }) {
      const [activeId, setActiveId] = useState(combos.length > 0 ? combos[0].id : '');
      const active = combos.find((combo) => combo.id === activeId) || null;
      const [name, setName] = useState('');
      const [note, setNote] = useState('');
      const [picker, setPicker] = useState('');

      useEffect(() => {
        if (!active && combos.length > 0) setActiveId(combos[0].id);
        if (active) { setName(active.name); setNote(active.note || ''); }
      }, [activeId, combos.length]);

      useEffect(() => {
        if (active) { setName(active.name); setNote(active.note || ''); }
      }, [active && active.id, active && active.updatedAt]);

      const candidates = useMemo(() => {
        if (!active) return [];
        const q = picker.trim().toLowerCase();
        const taken = new Set(active.items || []);
        return skills.filter((skill) => !taken.has(skill.id) && (!q || ((skill.displayName || '') + ' ' + skill.name + ' ' + skill.summary).toLowerCase().includes(q))).slice(0, 40);
      }, [skills, active, picker]);

      return h('div', { style: { display: 'flex', flex: 1, minHeight: 0 } },
        h('aside', {
          className: 'sc-scroll',
          style: { width: 250, flex: '0 0 auto', borderRight: '1px solid ' + C.border, padding: '10px 8px' },
        },
          h(Btn, {
            style: { width: '100%', justifyContent: 'center', marginBottom: 8 },
            onClick: async () => {
              const created = await run('createCombo', { name: '新组合' });
              if (created && created.comboId) setActiveId(created.comboId);
            },
          }, h(Icon, { name: 'plus', size: 12 }), '新建组合'),
          combos.length === 0
            ? h('div', { style: { color: C.text3, fontSize: 12, padding: '12px 8px', lineHeight: '19px' } },
              '组合就是"这几个 skill 一起用"。它只记引用：不改归类，也不复制文件。')
            : combos.map((combo) => h('button', {
              key: combo.id, type: 'button', className: 'sc-row',
              onClick: () => setActiveId(combo.id),
              style: {
                display: 'block', width: '100%', textAlign: 'left', padding: '7px 9px', marginBottom: 2,
                borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: activeId === combo.id ? C.l3 : 'transparent',
                color: activeId === combo.id ? C.text : C.text2,
              },
            },
              h('div', { style: { fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, combo.name),
              h('div', { style: { color: C.text3, fontSize: 11, marginTop: 2 } }, (combo.items || []).length + ' 个 skill' + (combo.missing.length ? ' · ' + combo.missing.length + ' 个已失效' : ''))
            ))
        ),

        h('section', { className: 'sc-scroll', style: { flex: 1, minWidth: 0, padding: '16px 18px 40px' } },
          !active
            ? h('div', { style: { color: C.text3, fontSize: 13, lineHeight: '21px', maxWidth: 560 } },
              '组合：把几个 skill 绑成一组，用的时候一次带上。',
              h('br'),
              '组合里存的是引用 —— 一个 skill 可以同时属于多个组合，也可以被移出，原来的归类位置不会动。')
            : h('div', { style: { maxWidth: 720 } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
                h('input', {
                  className: 'sc-input', value: name, onChange: (e) => setName(e.target.value),
                  style: { flex: 1, padding: '8px 11px', fontSize: 15, fontWeight: 600 },
                }),
                h(Btn, {
                  disabled: busy || name === active.name,
                  onClick: () => run('updateCombo', { id: active.id, name }),
                }, '改名'),
                h(Btn, {
                  kind: 'danger',
                  onClick: async () => {
                    if (!window.confirm('删除组合「' + active.name + '」？skill 本身不受影响。')) return;
                    await run('deleteCombo', { id: active.id });
                    setActiveId('');
                  },
                }, '删除')
              ),
              h('textarea', {
                className: 'sc-area', value: note, rows: 2, placeholder: '备注：这组 skill 一起干什么用（可留空）',
                onChange: (e) => setNote(e.target.value),
                onBlur: () => { if (note !== (active.note || '')) run('updateCombo', { id: active.id, note }); },
                style: { width: '100%', padding: '8px 10px', fontSize: 13, lineHeight: '19px', resize: 'vertical', boxSizing: 'border-box' },
              }),

              h('div', { style: { marginTop: 18, color: C.text3, fontSize: 11, letterSpacing: 0 } }, '组里的 skill（' + active.skills.length + '）'),
              h('div', { style: { marginTop: 6 } },
                active.skills.length === 0
                  ? h('div', { style: { color: C.text3, fontSize: 12, padding: '10px 0' } }, '还没有 skill，下面搜一个加进来')
                  : active.skills.map((item) => h('div', {
                    key: item.id, className: 'sc-row',
                    style: {
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 4,
                      borderRadius: 8, background: C.l1, border: '1px solid ' + C.border,
                    },
                  },
                    h('span', { style: { fontWeight: 500, fontSize: 13 } }, item.name),
                    h(Tag, null, item.app),
                    h('div', { style: { flex: 1 } }),
                    h(Btn, {
                      style: { padding: '2px 8px' },
                      onClick: () => run('toggleComboItem', { comboId: active.id, id: item.id }),
                    }, '移出')
                  )),
                active.missing.length > 0
                  ? h('div', { style: { color: C.warn, fontSize: 12, marginTop: 4 } }, active.missing.length + ' 个引用已失效（skill 被移动或删除），可以从组里删掉')
                  : null
              ),

              h('div', { style: { marginTop: 14, display: 'flex', gap: 8 } },
                h('input', {
                  className: 'sc-input', value: picker, placeholder: '搜一个 skill 加进这个组合…',
                  onChange: (e) => setPicker(e.target.value),
                  style: { flex: 1, padding: '6px 10px', fontSize: 13 },
                })
              ),
              picker.trim()
                ? h('div', {
                  style: {
                    marginTop: 6, maxHeight: 240, overflow: 'auto', border: '1px solid ' + C.border,
                    borderRadius: 8, background: C.l1,
                  },
                },
                  candidates.length === 0
                    ? h('div', { style: { padding: '10px 12px', color: C.text3, fontSize: 12 } }, '没有匹配的 skill')
                    : candidates.map((skill) => h('div', {
                      key: skill.id, className: 'sc-row',
                      onClick: async () => { await run('toggleComboItem', { comboId: active.id, id: skill.id }); setPicker(''); },
                      style: { padding: '7px 11px', cursor: 'pointer', borderBottom: '1px solid ' + C.border },
                    },
                      h('div', { style: { fontSize: 13, fontWeight: 500 } }, skill.displayName || skill.name),
                      h('div', { style: { color: C.text3, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.summary)
                    ))
                )
                : null,

              h('div', { style: { marginTop: 22 } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                  h('div', { style: { color: C.text3, fontSize: 11, letterSpacing: 0 } }, '调用指令'),
                  h('div', { style: { flex: 1 } }),
                  h(Btn, {
                    kind: 'primary', disabled: active.skills.length === 0,
                    title: '把这组 skill 送进对话输入框（不会自动发出去）',
                    onClick: () => sendToComposer(inputActions, active.skills.map((s) => '/' + (s.slug || s.name) + ' ').join(''), say),
                  }, '发送'),
                  h(Btn, {
                    kind: 'primary', disabled: active.skills.length === 0,
                    onClick: async () => {
                      const ok = await copyText(active.callText);
                      say(ok ? '已复制到剪贴板，粘到对话框里就能一次带上这组 skill' : '复制失败，手动选一下吧', ok ? 'ok' : 'err');
                    },
                  }, '复制指令')
                ),
                h('pre', {
                  style: {
                    margin: 0, padding: '10px 12px', background: C.l1, border: '1px solid ' + C.border,
                    borderRadius: 8, color: C.text2, fontSize: 12, lineHeight: '19px',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Consolas, monospace',
                  },
                }, active.callText || '（空组合）')
              )
            )
        )
      );
    }

    /* ------------------------------------------------------------ 来源与托管页 */

    /* ------------------------------------------------------------- 模型 / API 页 */


    function Sources({ model, roots, run, busy, say }) {
      const [label, setLabel] = useState('');
      const [dir, setDir] = useState('');

      return h('div', { className: 'sc-scroll', style: { flex: 1, padding: '16px 18px 40px' } },
        h('div', { style: { maxWidth: 880 } },
          h('div', { style: { color: C.text2, fontSize: 13, lineHeight: '20px', marginBottom: 12 } },
            'DSH 自己会读 ', h('code', { style: { color: C.text } }, '~/.dsh/skills'), ' 和 ',
            h('code', { style: { color: C.text } }, '~/.agents/skills'), '。下面这些位置是本机实际探测到的、以及其它 Agent / AI 应用的技能目录，存在才算数。'),

          h('div', { style: { border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden' } },
            roots.map((root, index) => h('div', {
              key: root.id,
              style: {
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderTop: index === 0 ? 'none' : '1px solid ' + C.border,
                opacity: root.enabled ? 1 : 0.5,
              },
            },
              h('div', { style: { width: 170, flex: '0 0 auto' } },
                h('div', { style: { fontSize: 13, fontWeight: 500 } }, root.label),
                h('div', { style: { color: C.text3, fontSize: 11 } }, root.app)
              ),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', {
                  style: { color: C.text2, fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace', wordBreak: 'break-all' },
                }, root.path),
                root.note ? h('div', { style: { color: C.text3, fontSize: 11, marginTop: 2 } }, root.note) : null
              ),
              h('div', { style: { color: root.exists ? C.text2 : C.text3, fontSize: 12, whiteSpace: 'nowrap' } },
                root.exists ? root.count + ' 个' : '不存在'),
              h('button', {
                type: 'button', title: root.enabled ? '不扫这个目录' : '扫描这个目录',
                onClick: () => run('toggleRoot', { id: root.id, enabled: !root.enabled }),
                style: {
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.text3,
                  cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit',
                  padding: '2px 4px', borderRadius: 6,
                },
              },
                h(CheckBox, { checked: root.enabled }),
                '扫'
              ),
              root.custom
                ? h(Btn, { style: { padding: '2px 8px' }, onClick: () => run('removeRoot', { id: root.id }) }, '移出')
                : h('span', { style: { width: 46 } })
            ))
          ),

          h('div', { style: { marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h('input', {
              className: 'sc-input', value: label, placeholder: '名字（可留空）',
              onChange: (e) => setLabel(e.target.value),
              style: { width: 150, padding: '6px 10px', fontSize: 13 },
            }),
            h('input', {
              className: 'sc-input', value: dir, placeholder: '要加的技能目录，例如 D:\\tools\\my-agent\\skills',
              onChange: (e) => setDir(e.target.value),
              style: { flex: 1, minWidth: 260, padding: '6px 10px', fontSize: 13 },
            }),
            h(Btn, {
              disabled: busy || !dir.trim(),
              onClick: async () => {
                const body = await run('addRoot', { label: label.trim(), path: dir.trim() });
                if (body) { setLabel(''); setDir(''); }
              },
            }, '加入扫描')
          ),

          h('div', { style: { marginTop: 26 } },
            h('div', { style: { color: C.text3, fontSize: 11, marginBottom: 6 } }, '托管记录（' + ((model.adopted || []).length) + '）'),
            (model.adopted || []).length === 0
              ? h('div', { style: { color: C.text3, fontSize: 12, lineHeight: '20px', maxWidth: 640 } },
                '还没有托管任何 skill。托管 = 把 skill 目录挪进 ', h('code', null, model.dshSkillRoot),
                '，并在原来的位置留一个链接：原应用照旧按老路径读到它，内容却只有一份，由 DSH 统一管。')
              : (model.adopted || []).map((record) => h('div', {
                key: record.name,
                style: {
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', marginBottom: 5,
                  borderRadius: 8, border: '1px solid ' + C.border, background: C.l1,
                },
              },
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontSize: 13, fontWeight: 500 } }, record.name),
                  h('div', { style: { color: C.text3, fontSize: 11, wordBreak: 'break-all', fontFamily: 'ui-monospace, Consolas, monospace' } },
                    record.from + '  →  ' + record.to)
                ),
                h(Btn, {
                  disabled: busy,
                  onClick: () => {
                    if (window.confirm('把「' + record.name + '」挪回 ' + record.from + '？')) run('restore', { name: record.name });
                  },
                }, '还回原位')
              ))
          ),

          h('div', { style: { marginTop: 26, padding: '10px 12px', border: '1px solid ' + C.border, borderRadius: 10, color: C.text3, fontSize: 12, lineHeight: '19px' } },
            '状态文件：', h('code', { style: { color: C.text2 } }, model.stateFile),
            h('br'),
            '扫描只认第一层的 skill：', h('code', null, '<name>/SKILL.md'), ' 目录包，或 ', h('code', null, '<name>.md'),
            ' 平铺文件；以 . 开头的目录会跳过。'
          )
        )
      );
    }

    /* -------------------------------------------------------------------- 挂载 */

    /** 右栏页签的类型名，也是左侧栏那一行的 id。 */
    const KIND = 'skill-center'
    /** 右栏页签开不出来时记下原因（本次页面加载内有效），点第二次就直接就地显示。 */
    let dockFailed = ''
    /** 用户主动选了「占满中间」就别再自动弹回右栏。 */
    let preferMain = false
    /** 页面组件在 apply 外面定义，靠这个拿到宿主服务。 */
    let CTX = null

    /** 右栏页签是不是我们自己开着的：只有它开着，才由我们决定右栏宽度。 */
    let dockWanted = false

    /**
     * 把右栏拉到宿主允许的最宽，让中间对话落到最小值（宿主的下限是 400px）。
     *
     * 宿主没有对外暴露 setRightbar 的控制器方法，但 layout 控制器上挂着 panels store
     * （`ctx.reflect.provide('layout', LayoutController)`，字段 `panels` = store 的 actions），
     * 直接调它的 setRightbar 就行。传一个够大的值：宿主自己会 clamp 到 0.7 视口，
     * 再由 computeColumns 用 `available = viewport - sidebar - 400` 兜住，中间列正好 400。
     */
    function fitDock(ctx) {
      try {
        const store = ctx.layout && ctx.layout.panels;
        if (!store || typeof store.setRightbar !== 'function') return false;
        const width = (typeof window !== 'undefined' && window.innerWidth) || 0;
        if (!width) return false;
        store.setRightbar(Math.round(width));
        return true;
      } catch (error) {
        return false; // 宽度调不动不影响用
      }
    }

    /** 刚开出来的那几帧里宿主可能还在恢复上次的布局，隔一会儿再按一次。 */
    function settleDock(ctx) {
      fitDock(ctx);
      setTimeout(() => fitDock(ctx), 160);
      setTimeout(() => fitDock(ctx), 600);
    }

    /** 全屏：右栏切到铺满整个窗口的 presentation，左右两边都让出来。 */
    function toggleFull() {      if (!CTX) return;
      try {
        const tabId = typeof CTX.sidebarRight.active === 'function' ? CTX.sidebarRight.active() : undefined;
        if (tabId !== undefined) { CTX.sidebarRight.toggleFullscreen(tabId); return; }
      } catch (error) { /* 老版本没有这个开关 */ }
      try { CTX.layout.openRightbar(true, true); } catch (error) { /* 没有右栏就算了 */ }
    }

    /**
     * 把页面开成右栏页签，并把中央列换回对话 —— 对话留着，页面并排在右边。
     *
     * 宿主里的关键机制（`ui-sidebar-right: on-screen Session` 那段）：
     *   show(activePanelId === null ? 当前会话 : undefined)
     * 也就是说**只有中央列显示对话时**，右栏的会话面板才算"在屏上"，`openTab` 才不会抛
     * `sidebarRight: no session surface is mounted`。所以顺序必须是：
     *   先把中央列换回对话 → 等它真的换过去 → 再 openTab。
     * 反过来的话（先 openTab 再 selectPanel）永远抛错，就是之前"打不开"的原因。
     */
    function openDock(ctx, onFail) {
      try { ctx.layout.selectPanel(null); } catch (error) { /* 没有 layout 就直接试 openTab */ }

      let tries = 0;
      const step = () => {
        tries += 1;
        try {
          ctx.sidebarRight.openTab(KIND);
          dockWanted = true;
          settleDock(ctx);
          return;
        } catch (error) {
          try { ctx.layout.openRightbar(true); } catch (ignored) { /* 老版本没有右栏 */ }
          if (tries < 24) { setTimeout(step, 100); return; }
          // 右栏撑起来了却没有页签，会把对话挤掉 —— 收回去，别让对话消失。
          try { ctx.layout.closeRightbar(); } catch (ignored) { /* 收不回去也没关系 */ }
          if (typeof onFail === 'function') onFail((error && error.message) || String(error));
        }
      };
      setTimeout(step, 60);
    }

    return {
      inject: ['slots', 'sidebarRight', 'sidebarRightTabs', 'layout'],
      apply(ctx) {
        CTX = ctx;
        // 1. 页签类型（不声明 patterns = 只能按 kind 打开）。重复注册会抛错，
        //    热重载时把错误吞掉，别让整个插件挂不上。
        ctx.effect(() => {
          try {
            return ctx.sidebarRightTabs.register({
              id: PKG,
              kind: KIND,
              multiple: false,
              priority: 'extension',
              title: () => 'Skill 中心',
              guide: [{
                id: KIND,
                order: 20,
                title: () => 'Skill 中心',
                description: () => '本机所有 skill 的说明书、归类与组合',
              }],
            });
          } catch (error) {
            return () => {};
          }
        }, 'skill-center.tab-type')

        // 2. 页签里的实体。页面挂上就算「右栏归我们管」：撑到最宽、窗口缩放时跟着重算，
        //    关掉页签就交还控制权，不去动别人的页签宽度。
        function DockPage(props) {
          useEffect(() => {
            dockWanted = true;
            settleDock(ctx);
            return () => { dockWanted = false; };
          }, []);
          return h(Page, { docked: true, inputActions: props && props.inputActions });
        }
        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: PKG,
          locale: PKG,
        }, DockPage))

        // 2b. 窗口缩放时重新撑开：右栏宽度是像素值，不重算的话对话会跟着窗口一起变宽。
        ctx.effect(() => {
          if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
          let timer = 0;
          const onResize = () => {
            if (!dockWanted) return;
            clearTimeout(timer);
            timer = setTimeout(() => fitDock(CTX), 120);
          };
          window.addEventListener('resize', onResize);
          return () => { clearTimeout(timer); window.removeEventListener('resize', onResize); };
        }, 'skill-center.dock-fit')

        // 3. 左侧栏入口（品牌下面、工作区上面那一排）
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: KIND,
          order: 1,
          label: 'Skill 中心',
          locale: PKG,
        }, SidebarIcon))

        // 4. 跳板。panellist 的每一行必须对应一个 main 面板，否则点了会抛错。
        //    点这一行 → 这个面板挂上 → 立刻把中央列换回对话、把页面开成右栏页签。
        //    万一右栏怎么都开不出来，再把这一页选回来，就地显示（顶上写清楚原因）。
        function Opener() {
          const [problem, setProblem] = useState(dockFailed);
          const [waiting, setWaiting] = useState(dockFailed === '' && !preferMain);

          useEffect(() => {
            if (preferMain) { setWaiting(false); return; }
            if (dockFailed !== '') { setProblem(dockFailed); setWaiting(false); return; }
            openDock(ctx, (message) => {
              dockFailed = message;
              try {
                fetch('api/skill-center/action', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ action: 'clientLog', message }),
                });
              } catch (error) { /* 记不下来也不影响用 */ }
              // 页面还得给人看，就选回这一页
              try { ctx.layout.selectPanel(KIND); } catch (error) { /* 选不回来就算了 */ }
            });
          }, []);

          if (!waiting) {
            return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
              problem ? h('div', {
                style: {
                  padding: '6px 12px', fontSize: 12, lineHeight: '17px', flex: '0 0 auto',
                  color: C.warn, background: 'rgba(217,164,65,.12)',
                  borderBottom: '1px solid ' + C.border, wordBreak: 'break-all',
                },
              }, '右栏页签没打开，页面改在这里显示：' + problem) : null,
              h(Page, { docked: false })
            );
          }

          return h('div', {
            style: {
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.text3, fontSize: 13,
            },
          }, '正在打开 Skill 中心…');
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: KIND,
          locale: PKG,
        }, Opener))
      },
    };
  },
});
