/*
 * Rechenlogik für den Abiturschnitt nach der Abiturverordnung
 * Baden-Württemberg (gymnasiale Oberstufe, Abitur ab 2021).
 *
 * Block I:  40 eingebrachte Halbjahresleistungen aus J1/J2, Leistungsfächer
 *           zählen doppelt. E_I = P / (S + L) * 40  (max. 600 Punkte)
 * Block II: 5 Prüfungsfächer, jeweils vierfach gewertet (max. 300 Punkte)
 * Note:     N = 17/3 - E/180, auf eine Nachkommastelle abgeschnitten
 *           (E >= 823 -> 1,0; E < 300 -> nicht bestanden)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AbiCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SEMESTERS = ["J1.1", "J1.2", "J2.1", "J2.2"];
  var REQUIRED_COURSES = 40;
  var EXAM_COUNT = 5;
  var MAX_BLOCK1 = 600;
  var MAX_BLOCK2 = 300;

  function isPoints(v) {
    return typeof v === "number" && isFinite(v) && v >= 0 && v <= 15 && Math.floor(v) === v;
  }

  /** Alle eingetragenen Halbjahresleistungen als flache Liste. */
  function listCourses(subjects) {
    var out = [];
    subjects.forEach(function (s, si) {
      SEMESTERS.forEach(function (_, hi) {
        var p = s.grades[hi];
        if (isPoints(p)) {
          out.push({
            subject: si,
            semester: hi,
            points: p,
            lf: !!s.lf,
            excluded: !!(s.excluded && s.excluded[hi])
          });
        }
      });
    });
    return out;
  }

  /** Subjects that are exam subjects have to be brought in completely. */
  function isMandatory(course, subjects, exams) {
    if (course.lf) return true;
    var name = (subjects[course.subject].name || "").trim().toLowerCase();
    if (!name) return false;
    return exams.some(function (e) {
      return (e.subject || "").trim().toLowerCase() === name;
    });
  }

  /**
   * Choose which courses count for Block I.
   * mode "auto": all Leistungsfach and exam-subject courses, then the best
   *              remaining ones until 40 are reached.
   * mode "manual": every entered course not marked as excluded.
   */
  function selectCourses(subjects, exams, mode) {
    var all = listCourses(subjects);
    if (mode === "manual") {
      return all.filter(function (c) { return !c.excluded; });
    }
    var mandatory = [];
    var optional = [];
    all.forEach(function (c) {
      (isMandatory(c, subjects, exams) ? mandatory : optional).push(c);
    });
    optional.sort(function (a, b) { return b.points - a.points; });
    var free = Math.max(0, REQUIRED_COURSES - mandatory.length);
    return mandatory.concat(optional.slice(0, free));
  }

  function block1(selected) {
    var weighted = 0;
    var weights = 0;
    var lfCount = 0;
    var under5 = 0;
    var zeros = 0;
    selected.forEach(function (c) {
      var w = c.lf ? 2 : 1;
      weighted += c.points * w;
      weights += w;
      if (c.lf) lfCount++;
      if (c.points < 5) under5++;
      if (c.points === 0) zeros++;
    });
    var count = selected.length;
    // Projection: average of the entered courses scaled to the full block.
    var projected = weights ? Math.round((weighted / weights) * REQUIRED_COURSES) : null;
    return {
      count: count,
      lfCount: lfCount,
      weightedSum: weighted,
      weights: weights,
      average: weights ? weighted / weights : null,
      points: projected,
      complete: count >= REQUIRED_COURSES,
      under5: under5,
      zeros: zeros
    };
  }

  function block2(exams, fallbackAverage) {
    var entered = exams.filter(function (e) { return isPoints(e.points); });
    var sum = 0;
    entered.forEach(function (e) { sum += e.points; });
    var avg = entered.length ? sum / entered.length : fallbackAverage;
    var missing = EXAM_COUNT - entered.length;
    var projected = avg == null ? null : Math.round((sum + missing * avg) * 4);
    var passedExams = entered.filter(function (e) { return e.points >= 5; }).length;
    return {
      count: entered.length,
      points: projected,
      complete: entered.length === EXAM_COUNT,
      estimated: missing > 0,
      passedExams: passedExams
    };
  }

  /** Umrechnung Gesamtpunktzahl -> Durchschnittsnote (KMK-Formel). */
  function pointsToGrade(total) {
    if (total == null) return null;
    if (total < 300) return null;
    if (total >= 823) return 1.0;
    var raw = 17 / 3 - total / 180;
    // Small epsilon guards against floating point artefacts like 2.0999999.
    return Math.floor(raw * 10 + 1e-9) / 10;
  }

  function calculate(state) {
    var subjects = state.subjects || [];
    var exams = state.exams || [];
    var selected = selectCourses(subjects, exams, state.mode);
    var b1 = block1(selected);
    var b2 = block2(exams, b1.average);
    var total = b1.points != null && b2.points != null ? b1.points + b2.points : null;

    var warnings = [];
    if (b1.count > REQUIRED_COURSES) {
      warnings.push("Es sind " + b1.count + " statt 40 Kurse eingebracht. Bitte im manuellen Modus Kurse abwählen.");
    }
    if (b1.complete && b1.count === REQUIRED_COURSES) {
      if (b1.points < 200) warnings.push("Block I: Mindestens 200 Punkte sind für die Zulassung erforderlich.");
      if (b1.under5 > 8) warnings.push("Block I: Höchstens 8 eingebrachte Kurse dürfen unter 5 Punkten liegen (aktuell " + b1.under5 + ").");
      if (b1.zeros > 0) warnings.push("Block I: Eingebrachte Kurse mit 0 Punkten sind nicht zulässig.");
    }
    if (b2.complete) {
      if (b2.points < 100) warnings.push("Block II: Mindestens 100 Punkte sind erforderlich.");
      if (b2.passedExams < 3) warnings.push("Block II: In mindestens drei Prüfungsfächern sind je mindestens 5 Punkte erforderlich.");
    }

    return {
      selected: selected,
      block1: b1,
      block2: b2,
      total: total,
      grade: pointsToGrade(total),
      final: b1.complete && b2.complete,
      warnings: warnings
    };
  }

  return {
    SEMESTERS: SEMESTERS,
    REQUIRED_COURSES: REQUIRED_COURSES,
    MAX_BLOCK1: MAX_BLOCK1,
    MAX_BLOCK2: MAX_BLOCK2,
    isPoints: isPoints,
    selectCourses: selectCourses,
    pointsToGrade: pointsToGrade,
    calculate: calculate
  };
});
