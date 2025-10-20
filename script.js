/* Quantix main JS*/

const display = document.getElementById('display');
const livePreview = document.getElementById('live-preview');
const btnGrid = document.getElementById('btnGrid');
const buttons = Array.from(btnGrid.querySelectorAll('button[data-pos]'));
const switchModeBtn = document.getElementById('switch-mode');
const themeToggleBtn = document.getElementById('theme-toggle');
const degRadBtn = document.getElementById('deg-rad');

const historyList = document.getElementById('history-list');
const historySearch = document.getElementById('history-search');
const clearHistoryBtn = document.getElementById('clear-history');

const memMC = document.getElementById('mc');
const memMR = document.getElementById('mr');
const memMPlus = document.getElementById('mplus');
const memMMinus = document.getElementById('mminus');

let mode = 'basic';         // 'basic' or 'scientific'
let themeDark = false;
let angleMode = 'DEG';      // 'DEG' or 'RAD'
let memoryVal = 0;
let history = [];           // {expr: 'sin(30)+5', result: '...'}

// ----- Configs: keep positions b0..b20 -----
const basicConfig = {
  b0:{label:'C', action:'clear'},
  b1:{label:'←', action:'back'},
  b2:{label:'÷', action:'÷'},
  b3:{label:'×', action:'×'},

  b4:{label:'7', action:'7'},
  b5:{label:'8', action:'8'},
  b6:{label:'9', action:'9'},
  b7:{label:'-', action:'-'},

  b8:{label:'4', action:'4'},
  b9:{label:'5', action:'5'},
  b10:{label:'6', action:'6'},
  b11:{label:'+', action:'+'},

  b12:{label:'1', action:'1'},
  b13:{label:'2', action:'2'},
  b14:{label:'3', action:'3'},
  b15:{label:'=', action:'equals'},

  b16:{label:'0', action:'0'},
  b17:{label:'.', action:'.'},
  b18:{label:'√', action:'sqrt'},
  b19:{label:'x²', action:'square'},

  b20:{label:'%', action:'percent'},
};

const sciConfig = {
  b0:{label:'C', action:'clear'},
  b1:{label:'←', action:'back'},
  b2:{label:'(', action:'('},
  b3:{label:')', action:')'},

  b4:{label:'sin', action:'sin'},
  b5:{label:'cos', action:'cos'},
  b6:{label:'tan', action:'tan'},
  b7:{label:'/', action:'/'},

  b8:{label:'log', action:'log10'},
  b9:{label:'ln', action:'ln'},
  b10:{label:'π', action:'pi'},
  b11:{label:'*', action:'*'},

  b12:{label:'e', action:'e'},
  b13:{label:'xʸ', action:'pow'},
  b14:{label:'√', action:'sqrt'},
  b15:{label:'=', action:'equals'},

  b16:{label:'EXP', action:'exp'},
  b17:{label:'!', action:'fact'},
  b18:{label:'.', action:'.'},
  b19:{label:'%', action:'percent'},

  b20:{label:'', action:''} // keep slot reserved
};

// Apply config into DOM buttons while preserving same slots
function applyConfig(cfg){
  buttons.forEach(btn=>{
    const pos = btn.dataset.pos;
    const conf = cfg[pos] || {label:'', action:''};
    btn.textContent = conf.label;
    btn.dataset.action = conf.action || '';
    btn.disabled = conf.label === '';
    btn.classList.remove('fade-in');
    // add tiny fade when config applied
    setTimeout(()=> btn.classList.add('fade-in'), 8);
  });
}
applyConfig(basicConfig);

// -------------------- Evaluation utilities --------------------
function prepareExpression(expr){
  // protect empty
  if(!expr) return '';

  let e = expr;

  // tokens: replace visual tokens with JS-safe forms
  // pi and e
  e = e.replace(/π/g, 'Math.PI');
  e = e.replace(/\be\b/g, 'Math.E'); // note: 'e' as standalone

  // EXP: we treat it as 'e' in scientific notation; user will add like '2.5EXP3' => '2.5e3'
  e = e.replace(/EXP/gi, 'e');

  // square notation x² -> **2 (also support **2 appended)
  e = e.replace(/x²/g, '**2');

  // sqrt token (we might append 'sqrt(' as user action)
  e = e.replace(/√\(/g, 'Math.sqrt(');
  e = e.replace(/√/g, 'Math.sqrt(');

  // factorial: replace n! with factorial(n)
  e = e.replace(/([0-9]+)!/g, 'factorial($1)');

  // pow: if user uses pow(, convert to Math.pow(
  e = e.replace(/pow\(/g, 'Math.pow(');

  // log10 and ln placeholders
  e = e.replace(/log10\(/g, 'Math.log10(');
  e = e.replace(/ln\(/g, 'Math.log(');

  // Trigonometric conversion depending on DEG/RAD
  if(angleMode === 'DEG'){
    // replace sin(  -> Math.sin(Math.PI/180*   so sin(30) => Math.sin(Math.PI/180*30)
    e = e.replace(/sin\(/g, 'Math.sin(Math.PI/180*');
    e = e.replace(/cos\(/g, 'Math.cos(Math.PI/180*');
    e = e.replace(/tan\(/g, 'Math.tan(Math.PI/180*');
    // also handle inverse if added later (not in current scope)
  } else { // RAD
    e = e.replace(/sin\(/g, 'Math.sin(');
    e = e.replace(/cos\(/g, 'Math.cos(');
    e = e.replace(/tan\(/g, 'Math.tan(');
  }

  // ensure log10 exists
  if(typeof Math.log10 !== 'function'){
    Math.log10 = function(x){ return Math.log(x)/Math.LN10; };
  }

  return e;
}

function factorial(n){
  n = Number(n);
  if(!Number.isInteger(n) || n < 0) throw new Error('Invalid factorial');
  if(n <= 1) return 1;
  let r = 1;
  for(let i=2;i<=n;i++) r *= i;
  return r;
}

function safeEval(expr){
  const prepared = prepareExpression(expr);
  return Function('Math','factorial', 'return ('+prepared+')')(Math, factorial);
}

// -------------------- UI helpers --------------------
function appendToDisplay(text){
  if(display.value === '' || display.value === '0') {
    if(text === '.') display.value = '0.';
    else display.value = text;
    updateLivePreview();
    return;
  }
  display.value += text;
  updateLivePreview();
}

function setDisplay(text){
  display.value = String(text);
  updateLivePreview();
}

// Update live preview: show expression and try evaluate preview as you type
function updateLivePreview(){
  const expr = display.value;
  livePreview.textContent = expr ? expr : '';
  // try to compute a preview result (don't crash on partial expr)
  try{
    const res = safeEval(expr);
    if(res !== undefined && expr.trim() !== '') {
      livePreview.textContent = expr + ' = ' + res;
    }
  }catch(e){
    // ignore broken partial expressions
  }
}

// -------------------- Action handler --------------------
function handleAction(action){
  if(!action) return;
  switch(action){
    case 'clear': setDisplay(''); break;
    case 'back': setDisplay(display.value.slice(0,-1)); break;
    case 'equals':
      try{
        if(!display.value) return;
        const result = safeEval(display.value);
        addHistory(display.value, result);
        setDisplay(result);
      }catch(err){
        setDisplay('Error');
      }
      break;
    case 'percent':
      try{
        const v = safeEval(display.value);
        const r = v/100;
        addHistory(display.value + '%', r);
        setDisplay(r);
      }catch(e){ setDisplay('Error') }
      break;
    case 'sqrt': appendToDisplay('√('); break; // prepareExpression converts √ to Math.sqrt(
    case 'square': appendToDisplay('**2'); break;
    case 'pow': appendToDisplay('pow('); break; // pow(a,b) converted to Math.pow
    case 'sin': appendToDisplay('sin('); break;
    case 'cos': appendToDisplay('cos('); break;
    case 'tan': appendToDisplay('tan('); break;
    case 'log10': appendToDisplay('log10('); break;
    case 'ln': appendToDisplay('ln('); break;
    case 'pi': appendToDisplay('π'); break;
    case 'e': appendToDisplay('e'); break;
    case 'exp': appendToDisplay('EXP'); break; // EXP -> 'e' during prepareExpression (scientific notation)
    case 'fact': appendToDisplay('!'); break;
    case '.': appendToDisplay('.'); break;
    default:
      // digits/operators/parentheses
      appendToDisplay(action);
  }
}

// -------------------- Button events (delegation) --------------------
btnGrid.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('button[data-pos]');
  if(!btn) return;
  const action = btn.dataset.action;
  handleAction(action);
});

// -------------------- Mode switching --------------------
switchModeBtn.addEventListener('click', ()=>{
  if(mode === 'basic'){
    applyConfig(sciConfig);
    mode = 'scientific';
    switchModeBtn.textContent = 'Scientific (on)';
    // reveal DEG indicator (visual)
    degRadBtn.style.display = 'inline-block';
  } else {
    applyConfig(basicConfig);
    mode = 'basic';
    switchModeBtn.textContent = 'Switch Mode';
    degRadBtn.style.display = 'none';
  }
});

// -------------------- Theme toggle --------------------
themeToggleBtn.addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
  themeDark = !themeDark;
});

// -------------------- DEG/RAD toggle --------------------
degRadBtn.addEventListener('click', ()=>{
  angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
  degRadBtn.textContent = angleMode;
});

// initially hide degRad (only in scientific)
degRadBtn.style.display = 'none';

// -------------------- Memory functions --------------------
memMC.addEventListener('click', ()=>{ memoryVal = 0; flashMem('MC') });
memMR.addEventListener('click', ()=>{ setDisplay(memoryVal); flashMem('MR') });
memMPlus.addEventListener('click', ()=>{
  try{
    const v = display.value ? safeEval(display.value) : 0;
    memoryVal = Number(memoryVal) + Number(v || 0);
    flashMem('M+');
  }catch(e){ flashMem('Err') }
});
memMMinus.addEventListener('click', ()=>{
  try{
    const v = display.value ? safeEval(display.value) : 0;
    memoryVal = Number(memoryVal) - Number(v || 0);
    flashMem('M-');
  }catch(e){ flashMem('Err') }
});

function flashMem(lbl){
  // tiny visual feedback on memory button group (set livePreview for a moment)
  const prev = livePreview.textContent;
  livePreview.textContent = lbl + ' → ' + memoryVal;
  setTimeout(()=> livePreview.textContent = prev, 900);
}

// -------------------- History handling --------------------
function addHistory(expr, result){
  const entry = { expr: String(expr), result: String(result) };
  history.unshift(entry); // newest first
  renderHistory();
  saveHistoryToStorage();
}

// render history list (with search applied)
function renderHistory(){
  const q = historySearch.value.trim().toLowerCase();
  historyList.innerHTML = '';
  history.forEach((h, idx)=>{
    const joined = (h.expr + ' = ' + h.result).toLowerCase();
    if(q && !joined.includes(q)) return; // filter
    const li = document.createElement('li');
    li.className = 'history-item';
    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    const exprSpan = document.createElement('span'); exprSpan.className = 'expr'; exprSpan.textContent = h.expr;
    const resSpan = document.createElement('span'); resSpan.className = 'res'; resSpan.textContent = h.result;
    left.appendChild(exprSpan); left.appendChild(resSpan);

    // right side: copy and reuse buttons
    const right = document.createElement('div');
    right.style.display = 'flex'; right.style.gap = '6px';
    // reuse button (click to place expression into display)
    const reuse = document.createElement('button'); reuse.className = 'copy-btn'; reuse.title = 'Reuse expression'; reuse.textContent = '↩';
    reuse.addEventListener('click', ()=>{ setDisplay(h.expr); });
    // copy button
    const copy = document.createElement('button'); copy.className = 'copy-btn'; copy.title = 'Copy result'; copy.textContent = '⧉';
    copy.addEventListener('click', ()=>{
      navigator.clipboard?.writeText(h.result).then(()=> {
        const old = copy.textContent; copy.textContent = '✓';
        setTimeout(()=> copy.textContent = old, 900);
      }).catch(()=>{ /* ignore */});
    });

    right.appendChild(reuse); right.appendChild(copy);
    li.appendChild(left); li.appendChild(right);
    historyList.appendChild(li);
  });
}

// search input
historySearch.addEventListener('input', renderHistory);

// clear history
clearHistoryBtn.addEventListener('click', ()=>{
  history = [];
  renderHistory();
  saveHistoryToStorage();
});

// persistent history with localStorage
function saveHistoryToStorage(){
  try{ localStorage.setItem('quantix_history_v1', JSON.stringify(history)); }catch(e){}
}
function loadHistoryFromStorage(){
  try{
    const raw = localStorage.getItem('quantix_history_v1');
    if(raw) history = JSON.parse(raw) || [];
  }catch(e){ history = [] }
}
loadHistoryFromStorage();
renderHistory();

// -------------------- Keyboard support --------------------
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){ e.preventDefault(); handleAction('equals'); return; }
  if(e.key === 'Backspace'){ handleAction('back'); return; }
  if(e.key === 'Escape'){ handleAction('clear'); return; }
  if((/^[0-9]$/).test(e.key)) { handleAction(e.key); return; }
  if(['+','-','*','/','(',')','.','%'].includes(e.key)) { handleAction(e.key); return; }
  // scientific shortcuts when in scientific mode
  if(mode === 'scientific'){
    switch(e.key.toLowerCase()){
      case 's': handleAction('sin'); return;
      case 'c': handleAction('cos'); return;
      case 't': handleAction('tan'); return;
      case 'l': handleAction('log10'); return;
      case 'n': handleAction('ln'); return;
      case 'p': handleAction('pi'); return;
      case 'e': handleAction('e'); return;
      case '!': handleAction('fact'); return;
    }
  }
});

// -------------------- Init: small helpers --------------------
function init(){
  updateLivePreview();
  // ensure deg button reflects current mode
  degRadBtn.textContent = angleMode;
  // tooltips
  degRadBtn.title = 'Toggle Degrees / Radians (affects sin/cos/tan)';
  // load memory from storage optionally (not persisted by default)
}
init();
