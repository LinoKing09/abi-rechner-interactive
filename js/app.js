(function () {
  "use strict";

  var Calc = window.AbiCalc;
  var Store = window.AbiStorage;
  var SEMESTERS = Calc.SEMESTERS;
  var FORMAT_ID = "abi-rechner-bw";
  var FORMAT_VERSION = 1;

  var DEFAULT_SUBJECTS = [
    "Deutsch", "Mathematik", "Englisch", "Physik", "Biologie",
    "Geschichte", "Geographie", "Gemeinschaftskunde", "Religion", "Sport"
  ];
  var EXAM_TYPES = [
    { label: "1. Prüfung", type: "Schriftlich (Leistungsfach)", written: true },
    { label: "2. Prüfung", type: "Schriftlich (Leistungsfach)", written: true },
    { label: "3. Prüfung", type: "Schriftlich (Leistungsfach)", written: true },
    { label: "4. Prüfung", type: "Mündlich / Präsentation", written: false },
    { label: "5. Prüfung", type: "Mündlich / Präsentation", written: false }
  ];

  var $ = function (sel) { return document.querySelector(sel); };
  var els = {
    body: $("#gradesBody"),
    table: $("#gradesTable"),
    exams: $("#exams"),
    account: $("#account"),
    guestNotice: $("#guestNotice"),
    modeHint: $("#modeHint"),
    counter: $("#courseCounter"),
    dialog: $("#authDialog"),
    authForm: $("#authForm"),
    authTitle: $("#authTitle"),
    authSubmit: $("#authSubmit"),
    authError: $("#authError"),
    toast: $("#toast"),
    saveState: $("#saveState")
  };

  var user = null;
  var state = null;
  var nextId = 1;
  var authMode = "login";

  /* ---------- state ---------- */

  function emptySubject(name) {
    return { id: nextId++, name: name || "", lf: false, grades: [null, null, null, null], excluded: [false, false, false, false] };
  }

  function defaultState() {
    return {
      mode: "auto",
      subjects: DEFAULT_SUBJECTS.map(emptySubject),
      exams: EXAM_TYPES.map(function () { return { subject: "", points: null }; })
    };
  }

  function toPoints(v) {
    if (v === "" || v == null) return null;
    var n = Number(v);
    return Calc.isPoints(n) ? n : null;
  }

  /** Validate and normalize data from storage or an imported file. */
  function sanitize(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Die Datei enthält keine gültigen Daten.");
    var data = raw.app === FORMAT_ID && raw.data ? raw.data : raw;
    if (!Array.isArray(data.subjects)) throw new Error("Die Datei enthält keine Fächerliste.");
    var subjects = data.subjects.slice(0, 30).map(function (s) {
      var sub = emptySubject(String((s && s.name) || "").slice(0, 60));
      sub.lf = !!(s && s.lf);
      for (var i = 0; i < 4; i++) {
        sub.grades[i] = toPoints(s && s.grades ? s.grades[i] : null);
        sub.excluded[i] = !!(s && s.excluded && s.excluded[i]);
      }
      return sub;
    });
    var exams = EXAM_TYPES.map(function (_, i) {
      var e = Array.isArray(data.exams) ? data.exams[i] : null;
      return { subject: String((e && e.subject) || "").slice(0, 60), points: toPoints(e && e.points) };
    });
    return { mode: data.mode === "manual" ? "manual" : "auto", subjects: subjects, exams: exams };
  }

  function serialize() {
    return {
      app: FORMAT_ID,
      version: FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        mode: state.mode,
        subjects: state.subjects.map(function (s) {
          return { name: s.name, lf: s.lf, grades: s.grades.slice(), excluded: s.excluded.slice() };
        }),
        exams: state.exams.map(function (e) { return { subject: e.subject, points: e.points }; })
      }
    };
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    var ok = Store.saveData(user, serialize());
    if (!user) {
      els.saveState.textContent = "Nicht angemeldet – Speicherung nur bis zum Schließen des Tabs.";
    } else if (ok) {
      var t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      els.saveState.textContent = "✓ Automatisch gespeichert um " + t + " Uhr";
    } else {
      els.saveState.textContent = "Speichern fehlgeschlagen – bitte exportieren Sie Ihre Daten.";
    }
  }

  function loadState() {
    var stored = Store.loadData(user);
    try {
      state = stored ? sanitize(stored) : defaultState();
    } catch (e) {
      state = defaultState();
    }
  }

  /* ---------- formatting ---------- */

  function fmt(n, digits) {
    return n == null ? "–" : n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { els.toast.classList.remove("is-visible"); }, 3200);
  }

  /* ---------- rendering ---------- */

  function renderGrades() {
    els.body.innerHTML = state.subjects.map(function (s, si) {
      var cells = SEMESTERS.map(function (sem, hi) {
        var v = s.grades[hi];
        return '<td class="cell" data-cell="' + si + "-" + hi + '">' +
          '<input type="number" class="points" inputmode="numeric" min="0" max="15" step="1" ' +
          'data-subject="' + si + '" data-semester="' + hi + '" value="' + (v == null ? "" : v) + '" ' +
          'aria-label="' + escapeHtml((s.name || "Fach") + " " + sem) + '">' +
          '<label class="count-toggle" title="Kurs einbringen"><input type="checkbox" data-exclude="' + si + "-" + hi + '"' +
          (s.excluded[hi] ? "" : " checked") + '><span class="sr-only">' + escapeHtml((s.name || "Fach") + " " + sem) + ' einbringen</span></label>' +
          "</td>";
      }).join("");
      return '<tr data-row="' + si + '">' +
        '<td class="col-subject"><input type="text" class="subject-name" list="subjectList" maxlength="60" placeholder="Fach eingeben" ' +
        'data-name="' + si + '" value="' + escapeHtml(s.name) + '" aria-label="Fachname"></td>' +
        '<td class="col-lf"><input type="checkbox" data-lf="' + si + '"' + (s.lf ? " checked" : "") +
        ' aria-label="' + escapeHtml(s.name || "Fach") + ' ist Leistungsfach"></td>' +
        cells +
        '<td class="col-avg" data-avg="' + si + '">–</td>' +
        '<td class="col-actions"><button type="button" class="icon-button" data-remove="' + si + '" aria-label="' +
        escapeHtml(s.name || "Fach") + ' entfernen" title="Fach entfernen">×</button></td>' +
        "</tr>";
    }).join("");
    els.table.classList.toggle("is-manual", state.mode === "manual");
    document.querySelectorAll('input[name="mode"]').forEach(function (r) { r.checked = r.value === state.mode; });
    els.modeHint.textContent = state.mode === "manual"
      ? "Wählen Sie über das Häkchen in jeder Zelle selbst, welche Kurse eingebracht werden. Es müssen genau 40 sein."
      : "Leistungsfächer und Prüfungsfächer werden vollständig eingebracht, die übrigen Plätze mit Ihren besten Kursen aufgefüllt. Markieren Sie Ihre drei Leistungsfächer in der Spalte „LF“.";
  }

  function subjectOptions(selected, onlyLf) {
    var names = state.subjects
      .filter(function (s) { return s.name.trim() && (!onlyLf || s.lf); })
      .map(function (s) { return s.name.trim(); });
    if (selected && names.indexOf(selected) === -1) names.unshift(selected);
    return '<option value="">– Fach wählen –</option>' + names.map(function (n) {
      return '<option value="' + escapeHtml(n) + '"' + (n === selected ? " selected" : "") + ">" + escapeHtml(n) + "</option>";
    }).join("");
  }

  function renderExams() {
    els.exams.innerHTML = EXAM_TYPES.map(function (t, i) {
      var e = state.exams[i];
      return '<div class="exam">' +
        '<div class="exam__label"><strong>' + t.label + "</strong><span>" + t.type + "</span></div>" +
        '<label class="field"><span>Fach</span><select data-exam-subject="' + i + '">' + subjectOptions(e.subject, t.written) + "</select></label>" +
        '<label class="field field--points"><span>Punkte</span><input type="number" class="points" inputmode="numeric" min="0" max="15" step="1" ' +
        'data-exam-points="' + i + '" value="' + (e.points == null ? "" : e.points) + '"></label>' +
        "</div>";
    }).join("");
  }

  function renderResult() {
    var r = Calc.calculate(state);

    // Mark counted / not counted cells.
    var counted = {};
    r.selected.forEach(function (c) { counted[c.subject + "-" + c.semester] = true; });
    document.querySelectorAll("#gradesBody td.cell").forEach(function (td) {
      var key = td.getAttribute("data-cell");
      var parts = key.split("-");
      var hasValue = state.subjects[parts[0]].grades[parts[1]] != null;
      td.classList.toggle("is-counted", hasValue && !!counted[key]);
      td.classList.toggle("is-dropped", hasValue && !counted[key]);
      var inp = td.querySelector("input.points");
      td.classList.toggle("is-low", hasValue && Number(inp.value) < 5);
    });

    state.subjects.forEach(function (s, si) {
      var vals = s.grades.filter(function (g) { return g != null; });
      var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
      var cell = document.querySelector('[data-avg="' + si + '"]');
      if (cell) cell.textContent = fmt(avg, 1);
    });

    var lfCount = state.subjects.filter(function (s) { return s.lf; }).length;
    els.counter.innerHTML = "<strong>" + r.block1.count + "</strong> von 40 Kursen eingebracht · " +
      "<strong>" + lfCount + "</strong> von 3 Leistungsfächern markiert";
    els.counter.classList.toggle("is-warning", r.block1.count > 40 || lfCount !== 3);

    $("#gradeValue").textContent = r.grade == null ? (r.total == null ? "–" : "n. b.") : fmt(r.grade, 1);
    $("#totalValue").textContent = r.total == null ? "–" : r.total;
    $("#b1Value").textContent = r.block1.points == null ? "–" : r.block1.points;
    $("#b2Value").textContent = r.block2.points == null ? "–" : r.block2.points;
    $("#b1Count").textContent = "(" + r.block1.count + "/40 Kurse)";
    $("#b2Count").textContent = "(" + r.block2.count + "/5 Prüfungen)";
    $("#b1Bar").style.width = r.block1.points == null ? "0" : (r.block1.points / 6) + "%";
    $("#b2Bar").style.width = r.block2.points == null ? "0" : (r.block2.points / 3) + "%";
    $("#avgValue").textContent = fmt(r.block1.average, 2);

    var status = $("#resultStatus");
    if (r.total == null) {
      status.textContent = "Noch keine Noten eingetragen";
      status.className = "result__status";
    } else if (r.final && r.block1.count === 40) {
      status.textContent = "Endergebnis";
      status.className = "result__status is-final";
    } else {
      status.textContent = "Hochrechnung auf Basis Ihrer bisherigen Noten";
      status.className = "result__status";
    }

    $("#warnings").innerHTML = r.warnings.map(function (w) { return "<li>" + escapeHtml(w) + "</li>"; }).join("");
  }

  function renderAccount() {
    if (user) {
      els.account.innerHTML =
        '<span class="account__user">Angemeldet als <strong>' + escapeHtml(user) + "</strong></span>" +
        '<button type="button" class="btn btn--small btn--secondary" data-action="logout">Abmelden</button>' +
        '<button type="button" class="btn btn--small btn--ghost" data-action="delete-account">Konto löschen</button>';
    } else {
      els.account.innerHTML =
        '<button type="button" class="btn btn--small btn--primary" data-action="open-login">Anmelden</button>' +
        '<button type="button" class="btn btn--small btn--secondary" data-action="open-register">Registrieren</button>';
    }
    els.guestNotice.hidden = !!user;
  }

  function renderAll() {
    renderAccount();
    renderGrades();
    renderExams();
    renderResult();
    saveNow();
  }

  /* ---------- behaviour ---------- */

  function syncWrittenExams() {
    var lfNames = state.subjects.filter(function (s) { return s.lf && s.name.trim(); }).map(function (s) { return s.name.trim(); });
    var used = state.exams.slice(0, 3).map(function (e) { return e.subject; });
    for (var i = 0; i < 3; i++) {
      if (lfNames.indexOf(state.exams[i].subject) === -1) {
        var free = lfNames.filter(function (n) { return used.indexOf(n) === -1; })[0] || "";
        state.exams[i].subject = free;
        used[i] = free;
      }
    }
  }

  function onInput(e) {
    var t = e.target;
    if (t.dataset.subject != null) {
      var raw = t.value;
      var p = toPoints(raw);
      t.classList.toggle("is-invalid", raw !== "" && p == null);
      state.subjects[t.dataset.subject].grades[t.dataset.semester] = p;
    } else if (t.dataset.name != null) {
      var subj = state.subjects[t.dataset.name];
      var old = subj.name.trim();
      subj.name = t.value;
      state.exams.forEach(function (ex) { if (old && ex.subject === old) ex.subject = t.value.trim(); });
      renderExams();
    } else if (t.dataset.examPoints != null) {
      var ep = toPoints(t.value);
      t.classList.toggle("is-invalid", t.value !== "" && ep == null);
      state.exams[t.dataset.examPoints].points = ep;
    } else {
      return;
    }
    renderResult();
    scheduleSave();
  }

  function onChange(e) {
    var t = e.target;
    if (t.dataset.lf != null) {
      var count = state.subjects.filter(function (s) { return s.lf; }).length;
      if (t.checked && count >= 3) {
        t.checked = false;
        toast("Es gibt genau drei Leistungsfächer.");
        return;
      }
      state.subjects[t.dataset.lf].lf = t.checked;
      syncWrittenExams();
      renderExams();
    } else if (t.dataset.exclude != null) {
      var k = t.dataset.exclude.split("-");
      state.subjects[k[0]].excluded[k[1]] = !t.checked;
    } else if (t.dataset.examSubject != null) {
      state.exams[t.dataset.examSubject].subject = t.value;
    } else if (t.name === "mode") {
      state.mode = t.value;
      if (state.mode === "manual") {
        // Start manual mode from the current automatic selection.
        var r = Calc.calculate({ subjects: state.subjects, exams: state.exams, mode: "auto" });
        var chosen = {};
        r.selected.forEach(function (c) { chosen[c.subject + "-" + c.semester] = true; });
        state.subjects.forEach(function (s, si) {
          for (var hi = 0; hi < 4; hi++) s.excluded[hi] = !chosen[si + "-" + hi];
        });
      }
      renderGrades();
    } else if (t.id === "importFile") {
      importFile(t.files[0]);
      t.value = "";
      return;
    } else {
      return;
    }
    renderResult();
    scheduleSave();
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function fileStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportJson() {
    download("abi-noten-" + fileStamp() + ".json", JSON.stringify(serialize(), null, 2), "application/json");
    toast("Noten als JSON exportiert.");
  }

  function csvCell(v) {
    var s = v == null ? "" : String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    var r = Calc.calculate(state);
    var lines = [["Fach", "Leistungsfach"].concat(SEMESTERS).join(";")];
    state.subjects.forEach(function (s) {
      lines.push([csvCell(s.name), s.lf ? "ja" : "nein"].concat(s.grades.map(csvCell)).join(";"));
    });
    lines.push("");
    lines.push("Prüfung;Art;Fach;Punkte");
    EXAM_TYPES.forEach(function (t, i) {
      lines.push([t.label, t.type, csvCell(state.exams[i].subject), csvCell(state.exams[i].points)].join(";"));
    });
    lines.push("");
    lines.push("Block I;" + csvCell(r.block1.points));
    lines.push("Block II;" + csvCell(r.block2.points));
    lines.push("Gesamt;" + csvCell(r.total));
    lines.push("Durchschnittsnote;" + (r.grade == null ? "" : fmt(r.grade, 1)));
    download("abi-noten-" + fileStamp() + ".csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
    toast("Noten als CSV exportiert.");
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast("Die Datei ist zu groß.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var imported;
      try {
        imported = sanitize(JSON.parse(reader.result));
      } catch (err) {
        toast("Import fehlgeschlagen: " + (err instanceof SyntaxError ? "Keine gültige JSON-Datei." : err.message));
        return;
      }
      if (!confirm("Die aktuellen Eingaben werden durch die importierten Noten ersetzt. Fortfahren?")) return;
      state = imported;
      renderAll();
      toast("Noten erfolgreich importiert.");
    };
    reader.onerror = function () { toast("Die Datei konnte nicht gelesen werden."); };
    reader.readAsText(file);
  }

  function hasEntries(s) {
    return s && (s.subjects.some(function (x) { return x.grades.some(function (g) { return g != null; }); }) ||
      s.exams.some(function (x) { return x.points != null; }));
  }

  /* ---------- auth dialog ---------- */

  function openAuth(mode) {
    setAuthMode(mode);
    els.authError.textContent = "";
    els.authForm.reset();
    els.authForm.remember.checked = true;
    if (typeof els.dialog.showModal === "function") els.dialog.showModal();
    else els.dialog.setAttribute("open", "");
    els.authForm.username.focus();
  }

  function closeAuth() {
    if (typeof els.dialog.close === "function") els.dialog.close();
    else els.dialog.removeAttribute("open");
  }

  function setAuthMode(mode) {
    authMode = mode;
    var reg = mode === "register";
    els.authTitle.textContent = reg ? "Konto erstellen" : "Anmelden";
    els.authSubmit.textContent = reg ? "Registrieren" : "Anmelden";
    els.authForm.password.setAttribute("autocomplete", reg ? "new-password" : "current-password");
    document.querySelectorAll(".tab").forEach(function (tab) {
      var active = tab.dataset.tab === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    els.authError.textContent = "";
  }

  function onAuthSubmit(e) {
    e.preventDefault();
    var f = els.authForm;
    var name = f.username.value;
    var pw = f.password.value;
    var remember = f.remember.checked;
    var guestState = state;
    els.authSubmit.disabled = true;
    var action = authMode === "register" ? Store.register(name, pw, remember) : Store.login(name, pw, remember);
    action.then(function (displayName) {
      user = displayName;
      var accountData = Store.loadData(user);
      if (authMode === "register" || !accountData) {
        state = guestState; // keep what was entered as guest
      } else if (hasEntries(guestState) && confirm("Sie haben als Gast Noten eingetragen. Sollen diese die in Ihrem Konto gespeicherten Noten ersetzen?\n\nAbbrechen lädt die gespeicherten Noten.")) {
        state = guestState;
      } else {
        loadState();
      }
      Store.clearGuest();
      closeAuth();
      renderAll();
      toast(authMode === "register" ? "Konto erstellt. Ihre Noten werden jetzt gespeichert." : "Willkommen zurück, " + user + "!");
    }).catch(function (err) {
      els.authError.textContent = err.message;
    }).then(function () {
      els.authSubmit.disabled = false;
    });
  }

  /* ---------- actions ---------- */

  var actions = {
    "add-subject": function () {
      state.subjects.push(emptySubject(""));
      renderGrades();
      renderResult();
      scheduleSave();
      var inputs = els.body.querySelectorAll(".subject-name");
      inputs[inputs.length - 1].focus();
    },
    "export-json": exportJson,
    "export-csv": exportCsv,
    "reset": function () {
      if (!confirm("Wirklich alle Eingaben löschen?")) return;
      state = defaultState();
      renderAll();
      toast("Alle Eingaben wurden zurückgesetzt.");
    },
    "open-login": function () { openAuth("login"); },
    "open-register": function () { openAuth("register"); },
    "close-dialog": closeAuth,
    "logout": function () {
      saveNow();
      Store.logout();
      user = null;
      state = defaultState();
      renderAll();
      toast("Sie wurden abgemeldet.");
    },
    "delete-account": function () {
      if (!confirm("Konto „" + user + "“ und alle darin gespeicherten Noten auf diesem Gerät endgültig löschen?")) return;
      Store.deleteAccount(user);
      user = null;
      state = defaultState();
      renderAll();
      toast("Das Konto wurde gelöscht.");
    }
  };

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (btn && actions[btn.dataset.action]) {
      actions[btn.dataset.action]();
      return;
    }
    var rm = e.target.closest("[data-remove]");
    if (rm) {
      var idx = Number(rm.dataset.remove);
      var s = state.subjects[idx];
      if (s.grades.some(function (g) { return g != null; }) && !confirm("Fach „" + (s.name || "ohne Namen") + "“ mit allen Noten entfernen?")) return;
      state.subjects.splice(idx, 1);
      syncWrittenExams();
      renderGrades();
      renderExams();
      renderResult();
      scheduleSave();
      return;
    }
    var tab = e.target.closest(".tab");
    if (tab) setAuthMode(tab.dataset.tab);
  });

  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  els.authForm.addEventListener("submit", onAuthSubmit);
  window.addEventListener("beforeunload", saveNow);

  // Highlight the navigation entry of the section in view.
  if ("IntersectionObserver" in window) {
    var links = document.querySelectorAll(".mainnav a");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    ["kurse", "pruefungen", "ergebnis", "daten", "info"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  /* ---------- start ---------- */

  user = Store.currentUser();
  loadState();
  renderAll();
})();
