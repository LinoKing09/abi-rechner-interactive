const test = require("node:test");
const assert = require("node:assert");
const AbiCalc = require("../js/calc.js");

const subject = (name, grades, lf = false) => ({ name, grades, lf, excluded: [false, false, false, false] });

test("pointsToGrade follows the KMK table", () => {
  assert.strictEqual(AbiCalc.pointsToGrade(900), 1.0);
  assert.strictEqual(AbiCalc.pointsToGrade(823), 1.0);
  assert.strictEqual(AbiCalc.pointsToGrade(822), 1.1);
  assert.strictEqual(AbiCalc.pointsToGrade(805), 1.1);
  assert.strictEqual(AbiCalc.pointsToGrade(804), 1.2);
  assert.strictEqual(AbiCalc.pointsToGrade(660), 2.0);
  assert.strictEqual(AbiCalc.pointsToGrade(300), 4.0);
  assert.strictEqual(AbiCalc.pointsToGrade(299), null);
});

test("full scenario with 3 LF and 7 other subjects", () => {
  const subjects = [
    subject("Deutsch", [12, 12, 12, 12], true),
    subject("Mathematik", [12, 12, 12, 12], true),
    subject("Englisch", [12, 12, 12, 12], true),
    ...["Physik", "Biologie", "Geschichte", "Geographie", "Gemeinschaftskunde", "Religion", "Sport"].map((n) =>
      subject(n, [12, 12, 12, 12])
    )
  ];
  const exams = [
    { subject: "Deutsch", points: 12 },
    { subject: "Mathematik", points: 12 },
    { subject: "Englisch", points: 12 },
    { subject: "Physik", points: 12 },
    { subject: "Geschichte", points: 12 }
  ];
  const r = AbiCalc.calculate({ subjects, exams, mode: "auto" });
  assert.strictEqual(r.block1.count, 40);
  assert.strictEqual(r.block1.points, 480);
  assert.strictEqual(r.block2.points, 240);
  assert.strictEqual(r.total, 720);
  assert.strictEqual(r.grade, 1.6);
  assert.ok(r.final);
});

test("auto mode keeps LF and exam subjects, drops worst others", () => {
  const subjects = [
    subject("Deutsch", [10, 10, 10, 10], true),
    subject("Mathematik", [10, 10, 10, 10], true),
    subject("Englisch", [10, 10, 10, 10], true),
    subject("Physik", [3, 3, 3, 3]),
    ...Array.from({ length: 7 }, (_, i) => subject("Fach" + i, [15, 15, 15, 15]))
  ];
  const exams = [{ subject: "Physik", points: null }];
  const sel = AbiCalc.selectCourses(subjects, exams, "auto");
  assert.strictEqual(sel.length, 40);
  // All four Physik courses stay because Physik is an exam subject.
  assert.strictEqual(sel.filter((c) => c.subject === 3).length, 4);
});

test("projection with partial data", () => {
  const subjects = [subject("Deutsch", [10, null, null, null], true), subject("Kunst", [13, null, null, null])];
  const r = AbiCalc.calculate({ subjects, exams: [], mode: "auto" });
  // (10*2 + 13) / 3 = 11 -> 440 / 220
  assert.strictEqual(r.block1.points, 440);
  assert.strictEqual(r.block2.points, 220);
  assert.strictEqual(r.grade, 2.0);
  assert.ok(!r.final);
});
