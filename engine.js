// engine.js — moteur commun du lab pentest (terminal simulé, indice/solution, copier-coller)
// Chaque cours définit ses propres 'steps', 'freeCommands' et 'freeContext' AVANT d'inclure ce fichier.
(function(){
  // ---------- ÉTAT ----------
  let stepIndex = 0;
  const initialFreeContext = freeContext; // capturé avant toute mutation, pour un reset fidèle au cours

  const body = document.getElementById("sim-body");
  const input = document.getElementById("sim-input");
  const inputline = document.getElementById("sim-inputline");
  const contextEl = document.getElementById("sim-context");
  const promptEl = document.getElementById("sim-prompt-label");
  const progressEl = document.getElementById("sim-progress");
  const progressFill = document.getElementById("term-progress-fill");
  const modeLabelEl = document.getElementById("sim-mode-label");
  const hintBox = document.getElementById("sim-hint-box");
  const consigneBox = document.getElementById("term-fs-consigne");
  const consigneTagEl = document.getElementById("consigne-tag");
  const consigneTextEl = document.getElementById("consigne-text");
  const hintBtn = document.getElementById("sim-hint-btn");
  const solutionBtn = document.getElementById("sim-solution-btn");
  const continueBtn = document.getElementById("sim-continue-btn");
  const connectBtn = document.getElementById("sim-connect-btn");
  const resetBtn = document.getElementById("sim-reset-btn");
  const analyzePopup = document.getElementById("analyze-popup");
  const apTag = document.getElementById("ap-tag");
  const apQuestion = document.getElementById("ap-question");
  const apContinueBtn = document.getElementById("ap-continue-btn");
  const termFullscreen = document.getElementById("term-fullscreen");
  const openBtn = document.getElementById("term-open-btn");
  const closeBtn = document.getElementById("term-close-btn");

  // historique de commandes, façon vrai shell (↑ / ↓)
  let cmdHistory = [];
  let historyPos = 0;

  function mode(){
    if(stepIndex >= steps.length) return "free";
    return steps[stepIndex].kind;
  }

  // ---------- OUVERTURE / FERMETURE PLEIN ÉCRAN ----------
  function openTerminal(){
    termFullscreen.style.display = "flex";
    requestAnimationFrame(()=> termFullscreen.classList.add("open"));
    document.documentElement.style.overflow = "hidden";
    setTimeout(()=> input.focus(), 200);
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

  function currentModeLabel(){
    if(mode() === "free") return "post-exploitation";
    const s = steps[stepIndex];
    if(s && typeof s.context === "string" && s.context.indexOf("msf") === 0) return "exploitation";
    return "reconnaissance";
  }

  // flash sobre au passage d'une étape à l'autre
  function flashSuccess(){
    body.classList.remove("flash-ok");
    void body.offsetWidth;
    body.classList.add("flash-ok");
  }

  function normalize(s){ return s.trim().toLowerCase().replace(/\s+/g," "); }

  // symbole de prompt en mode libre : ">" pour meterpreter, "#" pour un shell
  // root (contexte "root@..."), "$" sinon (utilisateur non-root, ex. msfadmin).
  // Convention basée sur le nommage déjà utilisé pour les contextes du lab.
  function freeSymbolFor(ctx){
    if(ctx === "meterpreter") return ">";
    if(ctx.indexOf("root@") === 0) return "#";
    return "$";
  }

  // rendu réaliste du prompt selon la machine/console — purement visuel,
  // ne change jamais la valeur logique de contextLabel utilisée ailleurs.
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

  // insère un nœud juste avant la ligne de saisie, qui reste ainsi toujours
  // la toute dernière ligne du terminal — comme un vrai prompt shell.
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
    modeLabelEl.textContent = currentModeLabel();

    // par défaut : popup d'analyse fermée, terminal net, consigne visible
    analyzePopup.style.display = "none";
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
      continueBtn.style.display = "none";
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
      continueBtn.style.display = "none";
      connectBtn.style.display = "none";
      hintBtn.disabled = false;
      solutionBtn.disabled = false;
      input.disabled = false;
      input.focus();
      body.scrollTop = body.scrollHeight;
    } else if(m === "analyze"){
      const s = steps[stepIndex];
      contextEl.textContent = "lecture du résultat";
      promptEl.textContent = "";
      progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      // la consigne passe par le pop-up dédié, pas par la barre du haut
      consigneBox.style.display = "none";
      inputline.style.display = "none";
      continueBtn.style.display = "none";
      connectBtn.style.display = "none";
      // en mode analyse, indice/solution vivent dans le pop-up : on cache les boutons du bas
      hintBtn.style.display = "none";
      solutionBtn.style.display = "none";
      apTag.textContent = "À analyser";
      apQuestion.textContent = s.question;
      analyzePopup.style.display = "flex";
      body.classList.add("dimmed");
      input.disabled = true;
      body.scrollTop = body.scrollHeight;
    } else {
      contextEl.textContent = freeContext;
      promptEl.innerHTML = promptHtml(freeContext, freeSymbolFor(freeContext));
      progressEl.textContent = "mode libre";
      consigneTagEl.textContent = "Mode libre";
      consigneTextEl.innerHTML = (typeof freeHintHtml !== "undefined" && freeHintHtml)
        ? freeHintHtml
        : `Session ouverte — explore par toi-même. Essaie <strong style="color:var(--text)">getuid</strong>, <strong style="color:var(--text)">shell</strong>, <strong style="color:var(--text)">whoami</strong>, <strong style="color:var(--text)">id</strong>, <strong style="color:var(--text)">pwd</strong>, <strong style="color:var(--text)">ls</strong> ou <strong style="color:var(--text)">exit</strong>.`;
      continueBtn.style.display = "none";
      connectBtn.style.display = "none";
      hintBtn.disabled = true;
      solutionBtn.disabled = true;
      input.disabled = false;
      input.focus();
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
    stepIndex++;
    afterAdvance();
  }

  function advanceAnalyzeStep(){
    const s = steps[stepIndex];
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
      // priorité absolue à la table du cours : si le cours définit explicitement
      // "exit" pour ce contexte, on l'utilise tel quel et on ne bricole rien.
      if(table["exit"] !== undefined){
        printLine(freeSymbolFor(freeContext), freeContext, raw, table["exit"]);
        input.disabled = true;
        progressEl.textContent = "terminé";
        return;
      }
      // sinon, comportement historique (scénario meterpreter → shell → exit),
      // pour les cours qui ne définissent pas "exit" eux-mêmes.
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

  function triggerAnalyzeContinue(){
    if(mode() !== "analyze") return;
    analyzePopup.classList.add("leaving");
    setTimeout(()=>{
      analyzePopup.classList.remove("leaving");
      advanceAnalyzeStep();
    }, 160);
  }

  apContinueBtn.addEventListener("click", triggerAnalyzeContinue);

  // en mode analyse, la touche Entrée déclenche un clic sur le bouton "Continuer →"
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && mode() === "analyze"){
      e.preventDefault();
      apContinueBtn.click();
    }
  });

  continueBtn.addEventListener("click", ()=> advanceAnalyzeStep());
  connectBtn.addEventListener("click", ()=> advanceConnectStep());

  resetBtn.addEventListener("click", ()=>{
    stepIndex = 0; freeContext = initialFreeContext;
    cmdHistory = []; historyPos = 0;
    // on retire tout SAUF la ligne de saisie (qu'on garde en mémoire), puis
    // on la replace pour qu'elle redevienne la seule ligne du terminal.
    Array.from(body.children).forEach(child=>{
      if(child !== inputline) child.remove();
    });
    body.appendChild(inputline);
    input.disabled = false; input.value = "";
    updateUI();
  });

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
