// engine.js — moteur commun du lab pentest (terminal simulé, indice/solution, copier-coller)
// Chaque cours définit ses propres 'steps', 'freeCommands' et 'freeContext' AVANT d'inclure ce fichier.
(function(){
  // ---------- ÉTAT ----------
  let stepIndex = 0;
  const initialFreeContext = freeContext; // capturé avant toute mutation, pour un reset fidèle au cours
  let userHasInteracted = false;          // évite l'ouverture du clavier mobile tant que l'utilisateur n'a pas touché l'input

  const body = document.getElementById("sim-body");
  const input = document.getElementById("sim-input");
  const inputline = document.getElementById("sim-inputline");
  const contextEl = document.getElementById("sim-context");
  const promptEl = document.getElementById("sim-prompt-label");
  const progressEl = document.getElementById("sim-progress");
  const progressFill = document.getElementById("term-progress-fill");
  const hintBox = document.getElementById("sim-hint-box");
  const consigneBox = document.getElementById("term-fs-consigne");
  const consigneTagEl = document.getElementById("consigne-tag");
  const consigneTextEl = document.getElementById("consigne-text");
  const hintBtn = document.getElementById("sim-hint-btn");
  const solutionBtn = document.getElementById("sim-solution-btn");
  const connectBtn = document.getElementById("sim-connect-btn");
  const resetBtn = document.getElementById("sim-reset-btn");
  const termFullscreen = document.getElementById("term-fullscreen");
  const openBtn = document.getElementById("term-open-btn");
  const closeBtn = document.getElementById("term-close-btn");
  // fil d'Ariane de méthode + carnet cumulatif (optionnels : un cours qui ne
  // fournit pas ces éléments dans son HTML continue de fonctionner sans eux)
  const phaseTrackEl = document.getElementById("phase-track");
  const notebookBtn = document.getElementById("notebook-btn");
  const notebookPanel = document.getElementById("notebook-panel");
  const notebookList = document.getElementById("notebook-list");
  const notebookCount = document.getElementById("notebook-count");

  // historique de commandes, façon vrai shell (↑ / ↓)
  let cmdHistory = [];
  let historyPos = 0;

  function mode(){
    if(stepIndex >= steps.length) return "free";
    return steps[stepIndex].kind;
  }

  // ---------- FOCUS CONDITIONNEL (anti-clavier-mobile) ----------
  function isMobileViewport(){
    return window.matchMedia("(max-width: 639px)").matches;
  }
  function maybeFocus(){
    // Sur mobile : on ne vole le focus que si l'utilisateur a déjà touché le champ.
    // Sur desktop : focus auto pour le confort de frappe.
    if(isMobileViewport() && !userHasInteracted) return;
    try{ input.focus({ preventScroll:true }); }catch(e){ input.focus(); }
  }

  // ---------- OUVERTURE / FERMETURE PLEIN ÉCRAN ----------
  function openTerminal(){
    termFullscreen.style.display = "flex";
    requestAnimationFrame(()=> termFullscreen.classList.add("open"));
    document.documentElement.style.overflow = "hidden";
    // Sur desktop uniquement : focus auto. Sur mobile, l'utilisateur touchera le champ lui-même.
    if(!isMobileViewport()){
      setTimeout(()=> input.focus({ preventScroll:true }), 200);
    }
  }
  function closeTerminal(){
    termFullscreen.classList.remove("open");
    document.documentElement.style.overflow = "";
    setTimeout(()=>{
      if(!termFullscreen.classList.contains("open")) termFullscreen.style.display = "none";
    }, 240);
  }
  openBtn.addEventListener("click", openTerminal);
  closeBtn.addEventListener("click", closeTerminal);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && termFullscreen.classList.contains("open")) closeTerminal();
  });

  // ---------- BARRE DE PROGRESSION ----------
  function updateProgress(){
    const total = steps.length;
    const pct = mode() === "free" ? 100 : Math.round((stepIndex/total)*100);
    progressFill.style.width = pct + "%";
    progressFill.classList.remove("pulse");
    void progressFill.offsetWidth;
    progressFill.classList.add("pulse");
  }

  // ---------- FIL D'ARIANE DE MÉTHODE ----------
  const PHASES = [
    {key:"recon", label:"recon"},
    {key:"recherche", label:"recherche exploit"},
    {key:"config", label:"config"},
    {key:"exploitation", label:"exploitation"},
    {key:"post-exploitation", label:"post-exploitation"}
  ];

  function currentPhaseKey(){
    if(mode() === "free") return "post-exploitation";
    const s = steps[stepIndex];
    if(s && s.phase) return s.phase;
    return "recon";
  }

  function renderPhaseTrackSkeleton(){
    if(!phaseTrackEl) return;
    phaseTrackEl.innerHTML = "";
    PHASES.forEach(p=>{
      const pill = document.createElement("span");
      pill.className = "phase-pill";
      pill.dataset.phase = p.key;
      pill.textContent = p.label;
      phaseTrackEl.appendChild(pill);
    });
  }

  function updatePhaseTrack(){
    if(!phaseTrackEl) return;
    const current = currentPhaseKey();
    phaseTrackEl.querySelectorAll(".phase-pill").forEach(pill=>{
      pill.classList.toggle("active", pill.dataset.phase === current);
    });
  }

  // ---------- CARNET DE MISSION (cumulatif entre tous les cours) ----------
  const NOTEBOOK_KEY = "pentestlab_notebook_v1";

  function loadNotebook(){
    try{ return JSON.parse(localStorage.getItem(NOTEBOOK_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveNotebook(list){
    try{ localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(list)); }
    catch(e){ /* stockage indisponible (navigation privée…) : le cours continue sans carnet persistant */ }
  }
  function addToNotebook(note, cmdLabel){
    if(!note || !notebookList) return;
    const list = loadNotebook();
    if(list.some(item => item.note === note)) { renderNotebook(); return; }
    list.push({ cmd: cmdLabel || "", note: note });
    saveNotebook(list);
    renderNotebook();
  }
  function renderNotebook(){
    if(!notebookList) return;
    const list = loadNotebook();
    if(notebookCount) notebookCount.textContent = list.length;
    notebookList.innerHTML = "";
    if(list.length === 0){
      notebookList.innerHTML = '<p class="notebook-empty">Ton carnet est vide pour l’instant — chaque commande validée avec une explication s’y ajoute, cours après cours.</p>';
      return;
    }
    list.forEach(item=>{
      const div = document.createElement("div");
      div.className = "notebook-item";
      div.innerHTML = `<div class="nb-cmd">${item.cmd}</div><div class="nb-note">${item.note}</div>`;
      notebookList.appendChild(div);
    });
  }
  if(notebookBtn && notebookPanel){
    notebookBtn.addEventListener("click", ()=> notebookPanel.classList.toggle("show"));
  }

  // flash sobre au passage d'une étape à l'autre
  function flashSuccess(){
    body.classList.remove("flash-ok");
    void body.offsetWidth;
    body.classList.add("flash-ok");
  }

  function normalize(s){ return s.trim().toLowerCase().replace(/\s+/g," "); }

  // symbole de prompt en mode libre
  function freeSymbolFor(ctx){
    if(ctx === "meterpreter") return ">";
    if(ctx.indexOf("root@") === 0) return "#";
    return "$";
  }

  // rendu réaliste du prompt selon la machine/console
  function promptHtml(ctx, sym){
    if(ctx === "kali@kali"){
      return `<span class="p-kali">`
        + `<span><span class="p-punc">┌──(</span><span class="p-user">kali</span><span class="p-punc">㉿</span><span class="p-user">kali</span><span class="p-punc">)-[~]</span></span>`
        + `<span><span class="p-punc">└─</span><span class="p-dollar">${sym}</span></span>`
        + `</span>`;
    }
    if(ctx === "root@metasploitable"){
      return `<span class="p-root">root@metasploitable</span><span class="p-punc">:</span><span class="p-path">~</span><span class="p-dollar">${sym}</span>`;
    }
    return `${ctx} <span class="p-dollar">${sym}</span>`;
  }

  // insère un nœud juste avant la ligne de saisie (toujours la dernière ligne)
  function pushLine(node){
    body.insertBefore(node, inputline);
  }

  function printLine(promptLabel, contextLabel, cmd, outputArr, opts){
    opts = opts || {};
    const cmdLine = document.createElement("div");
    cmdLine.className = "sim-line appear";
    const rendered = promptHtml(contextLabel, promptLabel);
    cmdLine.innerHTML = cmd !== null
      ? `<span class="p">${rendered}</span> ${cmd}`
      : `<span class="p">${rendered}</span>`;
    pushLine(cmdLine);
    (outputArr||[]).forEach(o=>{
      const line = document.createElement("div");
      line.className = "sim-line appear";
      if(o.id) line.id = o.id;
      line.innerHTML = `<span class="o ${o.c==='ok'?'ok':o.c==='err'?'err':''}">${o.t}</span>`;
      pushLine(line);
    });
    body.scrollTop = body.scrollHeight;
  }

  function bindBlurPeeks(container){
    container.querySelectorAll(".blur-peek").forEach(el=>{
      el.addEventListener("click", ()=> el.classList.toggle("revealed"));
    });
  }

  function updateUI(){
    hintBox.classList.remove("show");
    hintBox.innerHTML = "";
    const m = mode();
    updateProgress();
    updatePhaseTrack();

    body.classList.remove("dimmed");
    consigneBox.style.display = "flex";
    hintBtn.style.display = "";
    solutionBtn.style.display = "";

    if(m === "connect"){
      const s = steps[stepIndex];
      contextEl.textContent = "kali@kali";
      promptEl.innerHTML = promptHtml("kali@kali", "$");
      progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      consigneTagEl.textContent = "Configuration réseau";
      consigneTextEl.textContent = s.consigne;
      inputline.style.display = "none";
      connectBtn.style.display = "inline-flex";
      hintBtn.disabled = true;
      solutionBtn.disabled = true;
      input.disabled = true;
    } else if(m === "type"){
      const s = steps[stepIndex];
      contextEl.textContent = s.context;
      promptEl.innerHTML = promptHtml(s.context, s.prompt);
      progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      consigneTagEl.textContent = `À faire — étape ${stepIndex+1}/${steps.length}`;
      consigneTextEl.textContent = s.task;
      inputline.style.display = "flex";
      connectBtn.style.display = "none";
      hintBtn.disabled = false;
      solutionBtn.disabled = false;
      input.disabled = false;
      maybeFocus();
      body.scrollTop = body.scrollHeight;
    } else {
      contextEl.textContent = freeContext;
      promptEl.innerHTML = promptHtml(freeContext, freeSymbolFor(freeContext));
      progressEl.textContent = "mode libre";
      consigneTagEl.textContent = "Mode libre";
      consigneTextEl.innerHTML = (typeof freeHintHtml !== "undefined" && freeHintHtml)
        ? freeHintHtml
        : `Session ouverte — explore par toi-même. Essaie <strong style="color:var(--text)">getuid</strong>, <strong style="color:var(--text)">shell</strong>, <strong style="color:var(--text)">whoami</strong>, <strong style="color:var(--text)">id</strong>, <strong style="color:var(--text)">pwd</strong>, <strong style="color:var(--text)">ls</strong> ou <strong style="color:var(--text)">exit</strong>.`;
      connectBtn.style.display = "none";
      hintBtn.disabled = true;
      solutionBtn.disabled = true;
      input.disabled = false;
      maybeFocus();
      body.scrollTop = body.scrollHeight;
    }
  }

  function advanceConnectStep(){
    const s = steps[stepIndex];
    s.lines.forEach(l => printLine(l.prompt, l.context, l.cmd, l.output));
    stepIndex++;
    afterAdvance();
  }

  function advanceTypeStep(cmdShown){
    const s = steps[stepIndex];
    printLine(s.prompt, s.context, cmdShown, s.output);
    if(s.note) addToNotebook(s.note, s.accepted[0]);
    stepIndex++;
    highlightAndAnnotate(s);
    afterAdvance();
  }

  function afterAdvance(){
    flashSuccess();
    if(stepIndex >= steps.length){
      const info = document.createElement("div");
      info.className = "sim-line appear";
      info.innerHTML = `<span class="o ok">— session ouverte, terminal en mode libre —</span>`;
      pushLine(info);
    }
    updateUI();
  }

  function highlightAndAnnotate(step){
    (step.highlightIds||[]).forEach(id=>{
      const el = document.getElementById(id);
      if(el){
        el.classList.add("hl");
        setTimeout(()=> el.classList.remove("hl"), 2600);
      }
    });
    if(step.annotation){
      const annot = document.createElement("div");
      annot.className = "sim-annot appear";
      annot.textContent = step.annotation;
      pushLine(annot);
      body.scrollTop = body.scrollHeight;
    }
  }

  function handleFree(raw){
    const cmd = normalize(raw);
    const table = freeCommands[freeContext] || {};
    if(cmd === "exit"){
      if(table["exit"] !== undefined){
        printLine(freeSymbolFor(freeContext), freeContext, raw, table["exit"]);
        input.disabled = true;
        progressEl.textContent = "terminé";
        return;
      }
      if(freeContext !== "meterpreter"){
        freeContext = "meterpreter";
        printLine("#", "root@metasploitable", raw, [{t:"exit", c:"o"}]);
        updateUI();
        return;
      }
      printLine(">", "meterpreter", raw, [{t:"session terminée.", c:"o"}]);
      input.disabled = true;
      progressEl.textContent = "terminé";
      return;
    }
    if(table[cmd] !== undefined){
      printLine(freeSymbolFor(freeContext), freeContext, raw, table[cmd]);
      if(cmd === "shell"){ freeContext = "root@metasploitable"; updateUI(); }
      return;
    }
    printLine(freeSymbolFor(freeContext), freeContext, raw, [{t:"commande non reconnue dans cette simulation", c:"err"}]);
  }

  function goToHistory(pos){
    historyPos = pos;
    input.value = cmdHistory[historyPos] !== undefined ? cmdHistory[historyPos] : "";
    requestAnimationFrame(()=> input.setSelectionRange(input.value.length, input.value.length));
  }

  input.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowUp"){
      if(cmdHistory.length === 0) return;
      e.preventDefault();
      goToHistory(Math.max(0, historyPos - 1));
      return;
    }
    if(e.key === "ArrowDown"){
      if(cmdHistory.length === 0) return;
      e.preventDefault();
      if(historyPos >= cmdHistory.length - 1){ goToHistory(cmdHistory.length); }
      else{ goToHistory(historyPos + 1); }
      return;
    }
    if(e.key !== "Enter") return;
    const raw = input.value;
    if(!raw.trim()) return;
    cmdHistory.push(raw);
    historyPos = cmdHistory.length;
    input.value = "";

    const m = mode();
    if(m === "type"){
      const s = steps[stepIndex];
      const norm = normalize(raw);
      if(s.accepted.includes(norm)){
        advanceTypeStep(raw);
      } else if(s.wrongAnswers && s.wrongAnswers[norm]){
        printLine(s.prompt, s.context, raw, [{t:s.wrongAnswers[norm], c:"err"}]);
      } else {
        printLine(s.prompt, s.context, raw, [{t:"commande non reconnue — 💡 pour un indice, 🔍 pour la solution", c:"err"}]);
      }
    } else if(m === "free"){
      handleFree(raw);
    }
  });

  // ---------- TRACKING INTERACTION (anti-clavier mobile) ----------
  input.addEventListener("touchstart", ()=>{ userHasInteracted = true; }, { passive:true });
  input.addEventListener("click",     ()=>{ userHasInteracted = true; });
  input.addEventListener("focus",     ()=>{ userHasInteracted = true; });

  function toggleHintBox(boxEl, hintText){
    const isShown = boxEl.classList.contains("show");
    if(isShown){
      boxEl.classList.remove("show");
    } else {
      boxEl.innerHTML = "💡 " + hintText;
      boxEl.classList.add("show");
    }
  }

  hintBtn.addEventListener("click", ()=>{
    if(mode() !== "type") return;
    toggleHintBox(hintBox, steps[stepIndex].hint);
  });

  solutionBtn.addEventListener("click", ()=>{
    if(mode() !== "type") return;
    hintBox.classList.remove("show");
    advanceTypeStep(steps[stepIndex].accepted[0]);
  });

  connectBtn.addEventListener("click", ()=> advanceConnectStep());

  resetBtn.addEventListener("click", ()=>{
    stepIndex = 0;
    freeContext = initialFreeContext;
    cmdHistory = [];
    historyPos = 0;
    userHasInteracted = false;
    Array.from(body.children).forEach(child=>{
      if(child !== inputline) child.remove();
    });
    body.appendChild(inputline);
    input.disabled = false;
    input.value = "";
    updateUI();
  });

  renderPhaseTrackSkeleton();
  renderNotebook();
  updateUI();
})();

// ---------- BOUTONS "COPIER" DES COMMANDES DU COURS ----------
document.addEventListener("click", function(e){
  const btn = e.target.closest(".copy-btn");
  if(!btn) return;
  const text = btn.getAttribute("data-copy") || "";
  const done = ()=>{
    const original = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(()=>{ btn.textContent = original; btn.classList.remove("copied"); }, 1200);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>{
      fallbackCopy(text); done();
    });
  } else {
    fallbackCopy(text); done();
  }
});

function fallbackCopy(text){
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try{ document.execCommand("copy"); }catch(err){}
  document.body.removeChild(ta);
}
