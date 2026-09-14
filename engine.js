// engine.js — moteur commun du lab pentest (terminal simulé, indice/solution, copier-coller)
// Chaque cours définit ses propres 'steps', 'freeCommands' et 'freeContext' AVANT d'inclure ce fichier.
// Tous les éléments DOM sont traités comme optionnels : si un cours ne fournit pas
// un bouton (ex: plus de bouton "Connexion réseau"), le moteur continue de fonctionner.
(function(){
  // ---------- ÉTAT ----------
  let stepIndex = 0;
  const initialFreeContext = (typeof freeContext !== "undefined") ? freeContext : "kali@kali";
  let userHasInteracted = false;

  // ---------- HELPERS DOM TOLÉRANTS ----------
  function $(id){ return document.getElementById(id); }
  function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts); }

  const body = $("sim-body");
  const input = $("sim-input");
  const inputline = $("sim-inputline");
  const contextEl = $("sim-context");
  const promptEl = $("sim-prompt-label");
  const progressEl = $("sim-progress");
  const progressFill = $("term-progress-fill");
  const hintBox = $("sim-hint-box");
  const consigneBox = $("term-fs-consigne");
  const consigneTagEl = $("consigne-tag");
  const consigneTextEl = $("consigne-text");
  const hintBtn = $("sim-hint-btn");
  const solutionBtn = $("sim-solution-btn");
  const connectBtn = $("sim-connect-btn"); // optionnel — absent dans certains cours
  const resetBtn = $("sim-reset-btn");
  const termFullscreen = $("term-fullscreen");
  const openBtn = $("term-open-btn");
  const closeBtn = $("term-close-btn");
  const phaseTrackEl = $("phase-track");
  const notebookBtn = $("notebook-btn");
  const notebookPanel = $("notebook-panel");
  const notebookList = $("notebook-list");
  const notebookCount = $("notebook-count");

  // Si l'essentiel manque, on abandonne silencieusement (pas de crash).
  if(!body || !input || !inputline) return;

  // historique de commandes (↑ / ↓)
  let cmdHistory = [];
  let historyPos = 0;

  function mode(){
    if(typeof steps === "undefined") return "free";
    if(stepIndex >= steps.length) return "free";
    return steps[stepIndex].kind;
  }

  // ---------- FOCUS CONDITIONNEL (anti-clavier-mobile) ----------
  function isMobileViewport(){
    return window.matchMedia("(max-width: 639px)").matches;
  }
  function maybeFocus(){
    if(isMobileViewport() && !userHasInteracted) return;
    try{ input.focus({ preventScroll:true }); }catch(e){ input.focus(); }
  }

  // ---------- OUVERTURE / FERMETURE PLEIN ÉCRAN ----------
  function openTerminal(){
    if(!termFullscreen) return;
    termFullscreen.style.display = "flex";
    requestAnimationFrame(()=> termFullscreen.classList.add("open"));
    document.documentElement.style.overflow = "hidden";
    if(!isMobileViewport()){
      setTimeout(()=> input.focus({ preventScroll:true }), 200);
    }
  }
  function closeTerminal(){
    if(!termFullscreen) return;
    termFullscreen.classList.remove("open");
    document.documentElement.style.overflow = "";
    setTimeout(()=>{
      if(!termFullscreen.classList.contains("open")) termFullscreen.style.display = "none";
    }, 240);
  }
  on(openBtn, "click", openTerminal);
  on(closeBtn, "click", closeTerminal);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && termFullscreen && termFullscreen.classList.contains("open")) closeTerminal();
  });

  // ---------- BARRE DE PROGRESSION ----------
  function updateProgress(){
    if(!progressFill || typeof steps === "undefined") return;
    const total = steps.length;
    const pct = mode() === "free" ? 100 : Math.round((stepIndex/total)*100);
    progressFill.style.width = pct + "%";
  }

  // ---------- FIL D'ARIANE ----------
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

  // ---------- CARNET DE MISSION ----------
  const NOTEBOOK_KEY = "pentestlab_notebook_v1";

  function loadNotebook(){
    try{ return JSON.parse(localStorage.getItem(NOTEBOOK_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveNotebook(list){
    try{ localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(list)); }
    catch(e){}
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
    // Bouton de purge discret en pied de panneau
    const footer = document.createElement("div");
    footer.style.cssText = "margin-top:6px;padding-top:8px;border-top:1px solid var(--border);text-align:right;";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "vider le carnet";
    clearBtn.style.cssText = "font-family:var(--mono);font-size:11px;color:var(--muted);background:transparent;border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;transition:border-color .15s,color .15s;";
    clearBtn.addEventListener("mouseenter", ()=>{ clearBtn.style.borderColor="var(--accent)"; clearBtn.style.color="var(--accent)"; });
    clearBtn.addEventListener("mouseleave", ()=>{ clearBtn.style.borderColor="var(--border)"; clearBtn.style.color="var(--muted)"; });
    clearBtn.addEventListener("click", ()=>{
      if(confirm("Vider le carnet de toutes les notes cumulées ?")){
        try{ localStorage.removeItem(NOTEBOOK_KEY); }catch(e){}
        renderNotebook();
      }
    });
    footer.appendChild(clearBtn);
    notebookList.appendChild(footer);
  }
  on(notebookBtn, "click", ()=>{ if(notebookPanel) notebookPanel.classList.toggle("show"); });

  // ---------- HELPERS AFFICHAGE ----------
  function flashSuccess(){
    if(!body) return;
    body.classList.remove("flash-ok");
    void body.offsetWidth;
    body.classList.add("flash-ok");
  }

  function normalize(s){ return s.trim().toLowerCase().replace(/\s+/g," "); }

  function freeSymbolFor(ctx){
    if(ctx === "meterpreter") return ">";
    if(ctx.indexOf("root@") === 0) return "#";
    return "$";
  }

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

  function pushLine(node){
    if(!body || !inputline) return;
    body.insertBefore(node, inputline);
  }

  function printLine(promptLabel, contextLabel, cmd, outputArr){
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
    if(body) body.scrollTop = body.scrollHeight;
  }

  // ---------- UI ----------
  function updateUI(){
    if(!hintBox) return;
    hintBox.classList.remove("show");
    hintBox.innerHTML = "";
    const m = mode();
    updateProgress();
    updatePhaseTrack();

    if(body) body.classList.remove("dimmed");
    if(consigneBox) consigneBox.style.display = "flex";
    if(hintBtn) hintBtn.style.display = "";
    if(solutionBtn) solutionBtn.style.display = "";

    if(m === "connect"){
      const s = steps[stepIndex];
      if(contextEl) contextEl.textContent = "kali@kali";
      if(promptEl) promptEl.innerHTML = promptHtml("kali@kali", "$");
      if(progressEl) progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      if(consigneTagEl) consigneTagEl.textContent = "Configuration réseau";
      if(consigneTextEl) consigneTextEl.textContent = s.consigne;
      if(inputline) inputline.style.display = "none";
      if(connectBtn) connectBtn.style.display = "inline-flex";
      if(hintBtn) hintBtn.disabled = true;
      if(solutionBtn) solutionBtn.disabled = true;
      input.disabled = true;
    } else if(m === "type"){
      const s = steps[stepIndex];
      if(contextEl) contextEl.textContent = s.context;
      if(promptEl) promptEl.innerHTML = promptHtml(s.context, s.prompt);
      if(progressEl) progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      if(consigneTagEl) consigneTagEl.textContent = `À faire — étape ${stepIndex+1}/${steps.length}`;
      if(consigneTextEl) consigneTextEl.textContent = s.task;
      if(inputline) inputline.style.display = "flex";
      if(connectBtn) connectBtn.style.display = "none";
      if(hintBtn) hintBtn.disabled = false;
      if(solutionBtn) solutionBtn.disabled = false;
      input.disabled = false;
      maybeFocus();
      if(body) body.scrollTop = body.scrollHeight;
    } else {
      if(contextEl) contextEl.textContent = freeContext;
      if(promptEl) promptEl.innerHTML = promptHtml(freeContext, freeSymbolFor(freeContext));
      if(progressEl) progressEl.textContent = "mode libre";
      if(consigneTagEl) consigneTagEl.textContent = "Mode libre";
      if(consigneTextEl){
        consigneTextEl.innerHTML = (typeof freeHintHtml !== "undefined" && freeHintHtml)
          ? freeHintHtml
          : `Session ouverte — explore par toi-même. Essaie <strong style="color:var(--text)">whoami</strong>, <strong style="color:var(--text)">id</strong>, <strong style="color:var(--text)">pwd</strong>, <strong style="color:var(--text)">ls</strong> ou <strong style="color:var(--text)">exit</strong>.`;
      }
      if(connectBtn) connectBtn.style.display = "none";
      if(hintBtn) hintBtn.disabled = true;
      if(solutionBtn) solutionBtn.disabled = true;
      input.disabled = false;
      maybeFocus();
      if(body) body.scrollTop = body.scrollHeight;
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

  function handleFree(raw){
    const cmd = normalize(raw);
    const table = (typeof freeCommands !== "undefined" && freeCommands[freeContext]) || {};
    if(cmd === "exit"){
      if(table["exit"] !== undefined){
        printLine(freeSymbolFor(freeContext), freeContext, raw, table["exit"]);
        input.disabled = true;
        if(progressEl) progressEl.textContent = "terminé";
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
      if(progressEl) progressEl.textContent = "terminé";
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

  on(input, "keydown", (e)=>{
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

  // ---------- TRACKING INTERACTION ----------
  on(input, "touchstart", ()=>{ userHasInteracted = true; }, { passive:true });
  on(input, "click",      ()=>{ userHasInteracted = true; });
  on(input, "focus",      ()=>{ userHasInteracted = true; });

  function toggleHintBox(boxEl, hintText){
    if(!boxEl) return;
    const isShown = boxEl.classList.contains("show");
    if(isShown){
      boxEl.classList.remove("show");
    } else {
      boxEl.innerHTML = "💡 " + hintText;
      boxEl.classList.add("show");
    }
  }

  on(hintBtn, "click", ()=>{
    if(mode() !== "type" || !steps[stepIndex].hint) return;
    toggleHintBox(hintBox, steps[stepIndex].hint);
  });

  on(solutionBtn, "click", ()=>{
    if(mode() !== "type") return;
    if(hintBox) hintBox.classList.remove("show");
    advanceTypeStep(steps[stepIndex].accepted[0]);
  });

  on(connectBtn, "click", ()=> advanceConnectStep());

  // ---------- RESET (durci) ----------
  on(resetBtn, "click", ()=>{
    // Retour à l'étape 1, purge de l'historique et de la zone de sortie,
    // réaffichage de la ligne de saisie (au cas où on était en étape "connect"),
    // puis recalcul complet de l'UI.
    stepIndex = 0;
    if(typeof initialFreeContext !== "undefined") freeContext = initialFreeContext;
    cmdHistory = [];
    historyPos = 0;
    userHasInteracted = false;

    // Supprime toutes les lignes sauf la ligne de saisie, puis la remet en place.
    const children = Array.from(body.children);
    children.forEach(child=>{
      if(child !== inputline) child.remove();
    });
    body.appendChild(inputline);

    if(inputline) inputline.style.display = "flex";
    input.disabled = false;
    input.value = "";

    if(hintBox){ hintBox.classList.remove("show"); hintBox.innerHTML = ""; }

    updateProgress();
    updatePhaseTrack();
    updateUI();

    if(input.focus) {
      try{ input.focus({preventScroll:true}); }catch(e){}
    }
  });

  // ---------- INITIALISATION (après DOMContentLoaded) ----------
  // Garantit que les variables du cours (steps, freeContext, freeCommands)
  // sont bien définies avant le premier rendu, quel que soit l'ordre
  // des balises <script> dans le fichier HTML.
  function init(){
    renderPhaseTrackSkeleton();
    renderNotebook();
    updateUI();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
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
