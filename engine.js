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
  const connectBtn = $("sim-connect-btn");
  const resetBtn = $("sim-reset-btn");
  const termFullscreen = $("term-fullscreen");
  const openBtn = $("term-open-btn");
  const closeBtn = $("term-close-btn");
  const phaseTrackEl = $("phase-track");

  if(!body || !input || !inputline) return;

  let cmdHistory = [];
  let historyPos = 0;

  function mode(){
    if(typeof steps === "undefined") return "free";
    if(stepIndex >= steps.length) return "free";
    return steps[stepIndex].kind;
  }

  // ---------- BOUTON PLEIN ÉCRAN (injecté dynamiquement, fixe, toujours visible) ----------
  function injectFsToggle(){
    if(document.getElementById("fs-toggle")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fs-toggle";
    btn.id = "fs-toggle";
    btn.setAttribute("aria-label", "Basculer en plein écran");
    btn.title = "Plein écran";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 9V4h5"/>' +
        '<path d="M20 9V4h-5"/>' +
        '<path d="M4 15v5h5"/>' +
        '<path d="M20 15v5h-5"/>' +
      '</svg>';
    document.body.appendChild(btn);

    btn.addEventListener("click", ()=>{
      const doc = document;
      const el = doc.documentElement;
      if(!doc.fullscreenElement && !doc.webkitFullscreenElement){
        if(el.requestFullscreen){ el.requestFullscreen().catch(()=>{}); }
        else if(el.webkitRequestFullscreen){ el.webkitRequestFullscreen(); }
      } else {
        if(doc.exitFullscreen){ doc.exitFullscreen().catch(()=>{}); }
        else if(doc.webkitExitFullscreen){ doc.webkitExitFullscreen(); }
      }
    });

    function updateIcon(){
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      btn.innerHTML = isFs
        ? '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M9 4v5H4"/>' +
            '<path d="M15 4v5h5"/>' +
            '<path d="M9 20v-5H4"/>' +
            '<path d="M15 20v-5h5"/>' +
          '</svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M4 9V4h5"/>' +
            '<path d="M20 9V4h-5"/>' +
            '<path d="M4 15v5h5"/>' +
            '<path d="M20 15v5h-5"/>' +
          '</svg>';
      btn.title = isFs ? "Quitter le plein écran" : "Plein écran";
    }
    document.addEventListener("fullscreenchange", updateIcon);
    document.addEventListener("webkitfullscreenchange", updateIcon);
  }

  // ---------- FOCUS CONDITIONNEL (anti-clavier-mobile) ----------
  function isMobileViewport(){
    return window.matchMedia("(max-width: 639px)").matches;
  }
  function maybeFocus(){
    if(isMobileViewport() && !userHasInteracted) return;
    try{ input.focus({ preventScroll:true }); }catch(e){ input.focus(); }
  }

  // Ferme le clavier mobile (uniquement si on est sur mobile et que le clavier est ouvert)
  function blurInputOnMobile(){
    if(!isMobileViewport()) return;
    if(document.activeElement === input){
      input.blur();
    }
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
    blurInputOnMobile();
    // Réinitialise le padding (au cas où le clavier l'avait augmenté)
    if(body) body.style.paddingBottom = "";
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

  // Scroll vers la ligne de saisie après une commande
  function scrollToInput(){
    if(!body) return;
    requestAnimationFrame(()=>{
      body.scrollTop = body.scrollHeight;
    });
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
      scrollToInput();
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
      scrollToInput();
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
        // Succès : on ferme le clavier mobile pour que l'utilisateur voie le résultat
        // et la consigne suivante. On avance ensuite normalement.
        blurInputOnMobile();
        advanceTypeStep(raw);
      } else if(s.wrongAnswers && s.wrongAnswers[norm]){
        printLine(s.prompt, s.context, raw, [{t:s.wrongAnswers[norm], c:"err"}]);
        scrollToInput();
      } else {
        printLine(s.prompt, s.context, raw, [{t:"commande non reconnue — 💡 pour un indice, 🔍 pour la solution", c:"err"}]);
        scrollToInput();
      }
    } else if(m === "free"){
      // En mode libre : on ne ferme PAS le clavier (l'utilisateur explore),
      // on se contente d'afficher la réponse et de scroller.
      handleFree(raw);
      scrollToInput();
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
    blurInputOnMobile();
    advanceTypeStep(steps[stepIndex].accepted[0]);
  });

  on(connectBtn, "click", ()=> advanceConnectStep());

  // ---------- RESET (durci) ----------
  on(resetBtn, "click", ()=>{
    stepIndex = 0;
    if(typeof initialFreeContext !== "undefined") freeContext = initialFreeContext;
    cmdHistory = [];
    historyPos = 0;
    userHasInteracted = false;

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

  // ---------- GESTION DU CLAVIER MOBILE (padding dynamique, sans toucher à la hauteur) ----------
  // Quand le clavier Android/iOS s'ouvre, visualViewport.height diminue. On ajoute cette
  // différence en padding-bottom à la zone de contenu, ce qui pousse la ligne de saisie
  // au-dessus du clavier — SANS jamais modifier la hauteur du terminal (pas d'écran noir).
  // Cette approche fonctionne sur Android (où 100dvh ne se réduit pas) et reste neutre
  // sur desktop (où visualViewport.height == window.innerHeight → padding inchangé).
  function setupKeyboardPadding(){
    if(!window.visualViewport) return;
    const vv = window.visualViewport;
    const BASE_PADDING = 14; // correspond au padding normal de .sim-body sur mobile

    function updatePadding(){
      if(!termFullscreen || !termFullscreen.classList.contains("open")) return;
      const terminalRect = termFullscreen.getBoundingClientRect();
      const visibleBottom = vv.offsetTop + vv.height;
      const terminalBottom = terminalRect.top + terminalRect.height;
      const hiddenBottom = Math.max(0, terminalBottom - visibleBottom);
      if(body){
        // On ne réduit jamais en dessous de la base, on ne fait qu'ajouter.
        body.style.paddingBottom = (BASE_PADDING + hiddenBottom) + "px";
      }
      // Et on scrolle tout en bas pour que la ligne de saisie soit visible.
      requestAnimationFrame(()=>{
        if(body) body.scrollTop = body.scrollHeight;
      });
    }

    vv.addEventListener("resize", updatePadding);
    vv.addEventListener("scroll", updatePadding);

    // Quand on ferme le terminal, on remet le padding d'origine.
    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden && body){ body.style.paddingBottom = ""; }
    });
  }

  // ---------- INITIALISATION ----------
  function init(){
    injectFsToggle();
    setupKeyboardPadding();
    renderPhaseTrackSkeleton();
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
