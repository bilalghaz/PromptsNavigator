(() => {
  'use strict';

  /*──────────────────────────────────────
    1 · selectors / constants
  ───────────────────────────────────────*/
  const PROMPT_SEL = [
    'div[data-message-author-role="user"] .markdown',
    'div[data-message-author-role="user"] .whitespace-pre-wrap'
  ];
  const RESPONSE_SEL = ['.markdown', '.prose', 'p[data-start]'];
  const ROLE_USER    = '[data-message-author-role="user"]';
  const ROLE_ASSIST  = '[data-message-author-role="assistant"]';

  const KEYS   = { width:'sidebarWidth', height:'sidebarHeight',
                   anchor:'sidebarAnchor', theme:'themeColors' };
  const WIDTH  = { min:200, max:600, def:230 };
  const HEIGHT = { min:400, max:800, def:650 };
  const DEF_ANCHOR = 'center';
  const SAVE_LAG   = 500;   // ms debounce for storage
  const APPLY_DELAY= 700;   // ms delay after slider release


  const DEFAULT_START = '#212121';
  const DEFAULT_END   = '#171717';

  /*──────────────────────────────────────
    2 · inline SVG icons
  ───────────────────────────────────────*/
  const GEAR = `
    <svg viewBox="0 0 24 24" width="20" height="20"
         stroke="currentColor" fill="none" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.3 4.3c.4-1.2 1.9-1.2 2.3 0l.3.8a1 1 0 0 0 1.2.6l.9-.3a2 2 0 0 1 2.6 2.6l-.3.9a1 1 0 0 0 .6 1.2l.8.3c1.2.4 1.2 1.9 0 2.3l-.8.3a1 1 0 0 0-.6 1.2l.3.9a2 2 0 0 1-2.6 2.6l-.9-.3a1 1 0 0 0-1.2.6l-.3.8c-.4 1.2-1.9 1.2-2.3 0l-.3-.8a1 1 0 0 0-1.2-.6l-.9.3a2 2 0 0 1-2.6-2.6l.3-.9a1 1 0 0 0-.6-1.2l-.8-.3c-1.2-.4-1.2-1.9 0-2.3l.8-.3a1 1 0 0 0 .6-1.2l-.3-.9a2 2 0 0 1 2.6-2.6l.9.3a1 1 0 0 0 1.2-.6l.3-.8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`;
  const CLIP = `<svg viewBox="0 0 24 24" width="16" height="16"
        stroke="currentColor" fill="none" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6
               a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/></svg>`;
  const CLIP_OK = `<svg viewBox="0 0 24 24" width="16" height="16"
        stroke="currentColor" fill="none" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6
               a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <polyline points="9 14 11 16 15 12"/></svg>`;
  const EXPORT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M5 20h14v-2H5v2zm7-18L5.3 9h4.7v6h4V9h4.7L12 2z"/></svg>`;
  const DOWN_ICON  = `<span class="icon-[tabler--caret-up-down] size-4 shrink-0
      text-base-content absolute top-1/2 end-3 -translate-y-1/2"></span>`;
  const CHECK_ICON = `<span class="icon-[tabler--check] size-4 shrink-0
      text-primary hidden"></span>`;

  /*──────────────────────────────────────
    3 · state
  ───────────────────────────────────────*/
  let sidebar,toggleBtn,listEl,emptyState,settingsPanel,styleEl;
  let width = WIDTH.def, height = HEIGHT.def, anchor = DEF_ANCHOR;
  let theme = { mode:'gradient', start:null, end:null };
  let lastTexts = [];
  const idToUser = new Map();

  /*──────── helpers ───────*/
  const clamp = (v,l,h)=>Math.min(Math.max(v,l),h);
  const same  = (a,b)=>a.length===b.length && a.every((v,i)=>v===b[i]);
  const deb   = (fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
  const save  = (k,v)=>browser.storage.sync.set({[KEYS[k]]:v});
  const isEdit = el=>['INPUT','TEXTAREA'].includes(el?.nodeName)||el?.isContentEditable;

  /*──────────────────────────────────────
    4 · load prefs then build UI
  ───────────────────────────────────────*/
  browser.storage.sync.get(Object.values(KEYS),(d)=>{
    if(typeof d[KEYS.width]  ==='number') width  = clamp(d[KEYS.width] ,WIDTH.min,WIDTH.max);
    if(typeof d[KEYS.height] ==='number') height = clamp(d[KEYS.height],HEIGHT.min,HEIGHT.max);
    if(['top','center','bottom'].includes(d[KEYS.anchor])) anchor=d[KEYS.anchor];
    if(d[KEYS.theme]) Object.assign(theme,d[KEYS.theme]);
    document.body ? init() : setTimeout(init,50);
  });

  /*──────────────────────────────────────
    5 · build sidebar
  ───────────────────────────────────────*/
  function init(){
    /* toggle chevron */
    toggleBtn = Object.assign(document.createElement('div'),{
      className:'sidebar-toggle-button', textContent:'◀'
    });
    document.body.appendChild(toggleBtn);

    /* sidebar container */
    sidebar = Object.assign(document.createElement('div'),{
      id:'gpt-prompt-navigator-sidebar'
    });
    sidebar.classList.add(`anchor-${anchor}`,'visible');
    document.body.appendChild(sidebar);

    /* header with logo + BMC button */
    const logoURL = browser.runtime.getURL('logo.png');   // path to your PNG
    sidebar.innerHTML = `
      <div class="navigator-header">
        <img src="${logoURL}" alt="" class="nav-logo">
        <button class="settings-btn">${GEAR}</button>

        <!-- Buy-Me-a-Coffee button (static image, no external JS) -->
        <a id="bmc-link"
           href="https://www.buymeacoffee.com/Promptsnavigator"
           target="_blank" rel="noopener">
          <img id="bmc-img"
               src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
               alt="Buy me a coffee">
        </a>
      </div>

      <input class="navigator-search" placeholder="Search prompts…">
      <div id="settingsPanel" class="settings-panel"></div>
      <div class="navigator-empty-state" style="display:none;">No prompts found.</div>
      <ul class="navigator-list"></ul>
      <div class="resize-handle" title="Drag to resize"></div>`;

    /* ── extra CSS (logo & BMC) ───────────────────────────── */
    const css = `
      /* header stays flex; we just position the coffee button */
      .navigator-header{position:relative;padding:20px 28px;}

      .nav-logo{
        position:relative;
        top:6px;          /* tweak up/down  (+ down, – up)   */
        left:-70px;        /* tweak left/right (+ right, – left) */
        height:90px;      /* change logo size here            */
        width:auto;
      }

      /* BMC button absolute so it never shifts the layout   */
      #bmc-link{
        position:absolute;
        top:6px;           /* vertical adjust */
        right:48px;         /* horizontal adjust */
        z-index:1;
      }
      #bmc-img{
        display:block;
        width:94px;        /* button size — tweak freely */
        height:auto;
      }
    `;
    document.head.appendChild(
      Object.assign(document.createElement('style'), { textContent: css })
    );

    /* cache elements */
    listEl        = sidebar.querySelector('.navigator-list');
    emptyState    = sidebar.querySelector('.navigator-empty-state');
    settingsPanel = sidebar.querySelector('#settingsPanel');

    buildSettings();
    applyWidth();applyHeight();applyAnchor();applyTheme();

    /* listeners */
    toggleBtn.onclick = ()=>{
      sidebar.classList.toggle('visible');
      toggleBtn.textContent = sidebar.classList.contains('visible') ? '◀' : '▶';
    };
    sidebar.querySelector('.settings-btn')
      .onclick = ()=>settingsPanel.classList.toggle('open');
    sidebar.querySelector('.navigator-search')
      .addEventListener('input',deb(filterList,250));
    sidebar.querySelector('.resize-handle')
      .addEventListener('mousedown', dragStart);

    observeChat();
    window.addEventListener('keydown', keyNav, true);
  }

  /*──────────────────────────────────────
    6 · settings panel
  ───────────────────────────────────────*/
  function buildSettings(){
    settingsPanel.innerHTML = `
      <div class="setting-row">
        <label>Width <span id="wVal">${width}</span> px</label>
        <input id="wRange" type="range" min="${WIDTH.min}" max="${WIDTH.max}"
               step="1" value="${width}">
      </div>
      <div class="setting-row">
        <label>Height <span id="hVal">${height}</span> px</label>
        <input id="hRange" type="range" min="${HEIGHT.min}" max="${HEIGHT.max}"
               step="1" value="${height}">
      </div>
      <div class="join mb-2">
        <button id="resetSize"
          class="btn btn-soft btn-primary join-item text-[10px] px-3 py-1 rounded-full">
          Reset size
        </button>
        <button id="resetCol"
          class="btn btn-soft btn-primary join-item text-[10px] px-3 py-1 rounded-full">
          Reset colours
        </button>
      </div>
      <div class="max-w-sm mb-2"><select id="anchorSel" class="hidden">
        <option value="center">Center</option>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option></select></div>
      <div class="max-w-sm mb-2"><select id="modeSel" class="hidden">
        <option value="solid">Solid</option><option value="gradient">Gradient</option></select></div>
      <div class="setting-row">
        <input id="col1" type="color"><input id="col2" type="color">
      </div>`;

    /* enhance hidden select → dropdown button */
    function enhance(sel){
      const wrap=sel.parentElement, opts=[...sel.options];
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='advance-select-toggle flex justify-between items-center w-full px-3 py-2 rounded border text-xs relative';
      btn.innerHTML=`<span data-title>${opts[sel.selectedIndex].textContent}</span>${DOWN_ICON}`;
      wrap.appendChild(btn);
      const menu=document.createElement('div');
      menu.className='advance-select-menu mt-1 hidden bg-base-100 border rounded shadow-md text-xs z-50';
      opts.forEach((o,i)=>{
        const item=document.createElement('div');
        item.className='advance-select-option px-3 py-2 flex justify-between items-center w-full cursor-pointer';
        item.innerHTML=`<span data-title>${o.textContent}</span>${CHECK_ICON}`;
        if(i===sel.selectedIndex) item.querySelector('span+span').classList.remove('hidden');
        item.onclick=()=>{
          sel.selectedIndex=i;
          btn.querySelector('[data-title]').textContent=o.textContent;
          menu.querySelectorAll('.advance-select-option')
              .forEach(e=>e.querySelector('span+span').classList.add('hidden'));
          item.querySelector('span+span').classList.remove('hidden');
          menu.classList.add('hidden');
          sel.dispatchEvent(new Event('change',{bubbles:true}));
        };
        menu.appendChild(item);
      });
      wrap.appendChild(menu);
      btn.onclick=()=>menu.classList.toggle('hidden');
    }
    enhance(settingsPanel.querySelector('#anchorSel'));
    enhance(settingsPanel.querySelector('#modeSel'));

    /* sliders with 0.7 s settle */
    const wR=settingsPanel.querySelector('#wRange'),
          hR=settingsPanel.querySelector('#hRange'),
          wTx=settingsPanel.querySelector('#wVal'),
          hTx=settingsPanel.querySelector('#hVal');
    let tW,tH;
    wR.oninput=()=>{clearTimeout(tW);width=+wR.value;wTx.textContent=width;
      tW=setTimeout(()=>{applyWidth();save('width',width);},APPLY_DELAY);};
    hR.oninput=()=>{clearTimeout(tH);height=+hR.value;hTx.textContent=height;
      tH=setTimeout(()=>{applyHeight();save('height',height);},APPLY_DELAY);};

    /* reset buttons */
    settingsPanel.querySelector('#resetSize').onclick=()=>{
      width=WIDTH.def;height=HEIGHT.def;
      wR.value=width;hR.value=height;wTx.textContent=width;hTx.textContent=height;
      applyWidth();applyHeight();save('width',width);save('height',height);
    };
    settingsPanel.querySelector('#resetCol').onclick=()=>{
      theme={mode:'gradient',start:null,end:null};
      settingsPanel.querySelector('#modeSel').value='gradient';
      settingsPanel.querySelector('#col1').value=DEFAULT_START;
      settingsPanel.querySelector('#col2').value=DEFAULT_END;
      applyTheme();save('theme',theme);
    };

    /* anchor & colour pickers */
    const aSel=settingsPanel.querySelector('#anchorSel');
    aSel.value=anchor;
    aSel.onchange=()=>{anchor=aSel.value;applyAnchor();save('anchor',anchor);};

    const modeSel=settingsPanel.querySelector('#modeSel'),
          c1=settingsPanel.querySelector('#col1'),
          c2=settingsPanel.querySelector('#col2');
    const showC2=()=>c2.style.display=modeSel.value==='gradient'?'inline-block':'none';
    showC2();
    const debTheme=deb(()=>{applyTheme();save('theme',theme);},SAVE_LAG);
    modeSel.onchange=()=>{theme.mode=modeSel.value;showC2();debTheme();};
    c1.oninput=()=>{theme.start=c1.value;debTheme();};
    c2.oninput=()=>{theme.end  =c2.value;debTheme();};
    modeSel.value=theme.mode;
    c1.value=theme.start||DEFAULT_START;
    c2.value=theme.end  ||DEFAULT_END;
  }

  /*──────────────────────────────────────
    7 · style helpers & drag-resize
  ───────────────────────────────────────*/
  const applyWidth =()=> sidebar.style.width  = `${width}px`;
  const applyHeight=()=> sidebar.style.height = `${height}px`;
  const applyAnchor=()=>{
    sidebar.classList.remove('anchor-top','anchor-center','anchor-bottom');
    sidebar.classList.add(`anchor-${anchor}`);
  };
  const applyTheme=()=>{
    const s=theme.start|| DEFAULT_START,
          e=theme.mode==='solid'?s:(theme.end||DEFAULT_END);
    if(!styleEl){styleEl=document.createElement('style');document.head.appendChild(styleEl);}
    styleEl.textContent=`:root{--sidebar-bg-color-start:${s};--sidebar-bg-color-end:${e};}`;
  };
  function dragStart(ev){
    ev.preventDefault();
    const sx=ev.clientX, startW=width;
    const move=e=>{
      width=clamp(startW+(sx-e.clientX),WIDTH.min,WIDTH.max);
      applyWidth();
    };
    const up=()=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      save('width',width);
    };
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',up);
  }

  /*──────────────────────────────────────
    8 · chat scraping helpers
  ───────────────────────────────────────*/
  const joinP=el=>[...el.querySelectorAll('p')]
      .map(p=>p.innerText.trim()).filter(Boolean).join('\n');
  const findAssist=u=>{
    let n=u;while(n&&!n.nextElementSibling)n=n.parentElement;
    for(let cur=n?.nextElementSibling;cur;cur=cur.nextElementSibling){
      if(cur.matches(ROLE_ASSIST)) return cur;
      const nest=cur.querySelector(ROLE_ASSIST); if(nest) return nest;
    } return null;
  };
  const respTxt=u=>{
    const a=findAssist(u); if(!a) return '';
    const joined=joinP(a); if(joined) return joined;
    for(const s of RESPONSE_SEL){
      const n=a.matches(s)?a:a.querySelector(s);
      if(n && n.innerText.trim()) return n.innerText.trim();
    } return '';
  };
  const extras=el=>[
    ...[...el.querySelectorAll('img')].map(i=>`![img](${i.src})`),
    ...[...el.querySelectorAll('.border-token-border-default')]
       .map(d=>`[${d.querySelector('.truncate')?.innerText||'file'}] (attachment)`)
  ];

  /*──────────────────────────────────────
    9 · observe & build list
  ───────────────────────────────────────*/
  function observeChat(){
    new MutationObserver(deb(build,300))
      .observe(document.body,{childList:true,subtree:true});
    build();
  }
  function build(){
    const nodes=PROMPT_SEL.flatMap(sel=>[...document.querySelectorAll(sel)]);
    const rows=nodes.map((p,i)=>{
      const u=p.closest(ROLE_USER);
      const id=u?.getAttribute('data-message-id')||`auto-${i}`;
      idToUser.set(id,u);
      return {id,text:p.innerText.trim(),el:p};
    });
    if(same(rows.map(r=>r.text), lastTexts)) return;
    lastTexts=rows.map(r=>r.text);
    listEl.innerHTML='';
    rows.forEach((r,i)=>listEl.append(listItem(r,i)));
    emptyState.style.display = rows.length ? 'none' : 'block';
  }

  /*──────────────────────────────────────
    10 · list item factory
  ───────────────────────────────────────*/
  function listItem(r,i){
    const li=document.createElement('li');
    li.className='navigator-item';
    li.dataset.full=r.text; li.dataset.id=r.id;

    const span=document.createElement('span');
    span.className='navigator-item-text';
    span.textContent=`${i+1}: ${r.text}`;

    /* copy */
    const copy=document.createElement('button');
    copy.className='item-action-btn copy-btn';
    copy.innerHTML=`<span class="icon-default">${CLIP}</span>
                    <span class="icon-success" style="display:none;">${CLIP_OK}</span>`;
    copy.onclick=e=>{
      e.stopPropagation();
      const def=copy.querySelector('.icon-default'),
            ok =copy.querySelector('.icon-success');
      navigator.clipboard.writeText(r.text).then(()=>{
        def.style.display='none'; ok.style.display='block';
        setTimeout(()=>{def.style.display='block';ok.style.display='none';},1400);
      });
    };

    /* export */
    const exp=document.createElement('button');
    exp.className='item-action-btn export-btn';
    exp.innerHTML=EXPORT; exp.title='Export as TXT';
    exp.onclick=e=>{
      e.stopPropagation();
      const u=idToUser.get(r.id); if(!u) return;
      let out=`Prompt:\n${r.text}\n\nResponse:\n${respTxt(u)}`;
      const more=[...extras(u),...extras(u.nextElementSibling || document.createElement('div'))];
      if(more.length) out+='\n\n'+more.join('\n');
      const blob=new Blob([out],{type:'text/plain'});
      const link=Object.assign(document.createElement('a'),{
        href:URL.createObjectURL(blob), download:'chat_prompt.txt'
      });
      link.click(); URL.revokeObjectURL(link.href);
    };

    const actions=document.createElement('div');
    actions.className='navigator-item-actions';
    actions.append(copy,exp);
    li.append(span,actions);

    li.onclick=()=>{
      listEl.querySelector('.selected')?.classList.remove('selected');
      li.classList.add('selected');
      r.el.scrollIntoView({behavior:'smooth',block:'center'});
    };
    li.onkeydown=e=>{
      if(['Enter',' '].includes(e.key)){e.preventDefault();li.click();}
    };
    return li;
  }

  /*──────────────────────────────────────
    11 · search filter & keyboard nav
  ───────────────────────────────────────*/
  const filterList=e=>{
    const q=(e.target.value||'').toLowerCase().trim();
    listEl.querySelectorAll('.navigator-item')
      .forEach(li=>{
        li.style.display=li.dataset.full.toLowerCase().includes(q)?'flex':'none';
      });
  };
  function keyNav(e){
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||isEdit(e.target)) return;
    const move=d=>{
      const vis=[...listEl.querySelectorAll('.navigator-item')]
                .filter(li=>li.style.display!=='none');
      if(!vis.length) return;
      let idx=vis.findIndex(li=>li.classList.contains('selected'));
      if(idx===-1) idx=d>0?-1:0;
      vis[(idx+d+vis.length)%vis.length].click();
    };
    if(e.key==='j'){e.preventDefault();move( 1);}
    if(e.key==='k'){e.preventDefault();move(-1);}
  }
})();
