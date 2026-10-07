"use strict";

/* ============================================================
   THE WEEKLY LOG
   ============================================================

   Hours a week against a goal, from two places at once.

   The trainers already say how long they were played — that is the `minutes`
   table every other panel reads. What they cannot say is the other half of a
   plan that is mostly *study*: an evening on measure theory leaves no export
   behind. So study time is written down here, one entry per sitting or per day,
   and a week is the sum of both.

   Three things about it are deliberate:

   **A week with nothing in it counts as zero.** The average runs from the
   diary's first week to the last finished one, and a week skipped is a week in
   the denominator. An average taken only over the weeks somebody remembered to
   log is the number every diary flatters itself with, and it is exactly the
   number a retest in five months would contradict.

   **The week in progress is not averaged.** Tuesday's three hours are not a
   three-hour week, and folding them in would drag the average down every
   Monday and recover it every Sunday. It is shown apart, with what it still
   needs.

   **Study entries merge like notes**, by `editedAt` with tombstones, because
   they are authored in the same sense: no export will ever hold them, and an
   older copy of the archive folded in later must not bring back an entry that
   was deleted.
*/

var DEFAULT_DIARY_NAME = "The Lantern Hours";
var DEFAULT_GOAL_HOURS = 14;
/* Longer than any day has, so a typo of 30 for 3.0 is refused rather than
   becoming a fortnight's goal met in one sitting. */
var MAX_ENTRY_MINUTES = 24 * 60;

function isDay(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

/** Collapse spacing so "Real  analysis " and "Real analysis" are one subject. */
function cleanSubject(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}

/**
 * One sitting of study. Minutes are stored, not hours, so the file holds whole
 * numbers and a week's sum is never 13.999999999999998.
 *
 * Accepts `hours` (what the form asks for) or `minutes` (what the file holds).
 */
function makeStudy(fields) {
  var f = fields || {};
  var at = Number(f.at) || Date.now();
  var minutes = f.minutes != null && String(f.minutes).trim() !== ""
    ? Math.round(Number(f.minutes))
    : f.hours != null && String(f.hours).trim() !== ""
      ? Math.round(Number(f.hours) * 60)
      : 0;
  if (!isFinite(minutes)) minutes = 0;
  return {
    id: String(f.id || ""),
    /* The day as the person gave it — local, like a note's, because "I studied
       on Tuesday" means their Tuesday. See `makeNote`. */
    day: isDay(f.day) ? String(f.day) : new Date(at).toISOString().slice(0, 10),
    at: at,
    editedAt: Number(f.editedAt) || at,
    subject: cleanSubject(f.subject),
    minutes: Math.max(0, minutes),
    text: f.text == null ? "" : String(f.text).trim(),
    deleted: !!f.deleted,
  };
}

/** Why an entry cannot be saved, or "" if it can. */
function studyProblem(entry) {
  if (!entry.subject) return "Give it a subject.";
  if (!(entry.minutes > 0)) return "Give it a time above zero.";
  if (entry.minutes > MAX_ENTRY_MINUTES) return "That is more than a day — split it, or check the number.";
  return "";
}

/** Identity and time, no content — see `tombstone` in notes.js. */
function studyTombstone(entry, when) {
  return makeStudy({
    id: entry.id, day: entry.day, at: entry.at,
    editedAt: Number(when) || Date.now(), deleted: true,
  });
}

/** Union on id, the later `editedAt` winning, ties keeping what is here. */
function mergeStudy(existing, incoming) {
  var byId = new Map();
  (existing || []).forEach(function (e) { byId.set(e.id, e); });
  var added = 0, updated = 0;
  (incoming || []).forEach(function (raw) {
    var e = makeStudy(raw);
    if (!e.id) return;
    var have = byId.get(e.id);
    if (!have) { byId.set(e.id, e); added++; return; }
    if (e.editedAt > Number(have.editedAt)) { byId.set(e.id, e); updated++; }
  });
  var study = Array.from(byId.values()).sort(function (a, b) {
    return a.day < b.day ? -1 : a.day > b.day ? 1 : a.at - b.at;
  });
  return { study: study, added: added, updated: updated, total: study.length };
}

function visibleStudy(archive) {
  return ((archive && archive.study) || [])
    .filter(function (e) { return !e.deleted; })
    .slice()
    .sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : b.at - a.at; });
}

/** Subjects in use, most hours first, for suggesting one spelling. */
function knownSubjects(archive) {
  var by = {};
  visibleStudy(archive).forEach(function (e) {
    var k = e.subject.toLowerCase();
    if (!by[k]) by[k] = { subject: e.subject, minutes: 0 };
    by[k].minutes += e.minutes;
  });
  return Object.keys(by).map(function (k) { return by[k]; })
    .sort(function (a, b) { return b.minutes - a.minutes; });
}

/* ------------------------------------------------------------------ *
 * The diary's own settings                                            *
 * ------------------------------------------------------------------ */

function makeDiary(fields) {
  var f = fields || {};
  var goal = Number(f.goalHours);
  return {
    name: cleanSubject(f.name) || DEFAULT_DIARY_NAME,
    goalHours: goal > 0 && goal <= 168 ? goal : DEFAULT_GOAL_HOURS,
    /* The first day the diary counts from. Before it, trainer time is history
       and not part of the plan — a hundred hours of last year's play would
       otherwise make the first month's average meaningless. */
    start: isDay(f.start) ? String(f.start) : null,
    editedAt: Number(f.editedAt) || 0,
  };
}

/** Whichever was set last. A diary never set has editedAt 0 and loses. */
function mergeDiary(a, b) {
  if (!a) return b ? makeDiary(b) : null;
  if (!b) return makeDiary(a);
  return Number(b.editedAt) > Number(a.editedAt) ? makeDiary(b) : makeDiary(a);
}

/**
 * Fold an archive file's study and diary in. Kept apart from `fold`, like
 * `foldNotes`, because they belong to no source.
 */
function foldStudy(archive, study, diary) {
  var merged = mergeStudy(archive.study || [], study || []);
  archive.study = merged.study;
  var before = archive.diary ? JSON.stringify(archive.diary) : "";
  archive.diary = mergeDiary(archive.diary || null, diary || null);
  var diaryChanged = (archive.diary ? JSON.stringify(archive.diary) : "") !== before;
  if (merged.added || merged.updated || diaryChanged) archive.updatedAt = Date.now();
  return { added: merged.added, updated: merged.updated, diary: diaryChanged };
}

/* ------------------------------------------------------------------ *
 * Weeks                                                               *
 * ------------------------------------------------------------------ */

function shiftDay(day, n) {
  var d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday a day's week starts on — the same weeks `isoWeek` counts. */
function weekStart(day) {
  var d = new Date(day + "T00:00:00Z");
  var back = (d.getUTCDay() + 6) % 7;            // Monday = 0
  return shiftDay(day, -back);
}

/**
 * Where the diary starts: the day set for it, or else the first study entry,
 * or else this week. Never earlier than that on the strength of trainer
 * records alone — see `makeDiary`.
 */
function diaryStart(archive, today) {
  var diary = makeDiary(archive && archive.diary);
  if (diary.start) return diary.start;
  var study = visibleStudy(archive);
  if (study.length) return study[study.length - 1].day;
  return today;
}

/**
 * The log: one row per week from the diary's start to this week, plus what
 * they come to.
 *
 * `today` is passed in rather than read, so the tests can stand on a fixed
 * day and so the page can pass its *local* day — the week a person is in is
 * the one on their calendar.
 */
function weeklyLog(archive, opts) {
  var o = opts || {};
  var today = isDay(o.today) ? o.today : new Date().toISOString().slice(0, 10);
  var diary = makeDiary(archive && archive.diary);
  var goalMinutes = diary.goalHours * 60;
  var startDay = diaryStart(archive, today);
  var first = weekStart(startDay);
  var current = weekStart(today);

  var weeks = [];
  var index = {};
  // A start set in the future still shows the week it begins in.
  var last = current < first ? first : current;
  for (var w = first; w <= last; w = shiftDay(w, 7)) {
    index[w] = weeks.length;
    weeks.push({
      week: w, trainer: 0, study: 0, total: 0,
      bySource: {}, bySubject: {}, current: w === current, future: w > current,
    });
  }
  function rowFor(day) {
    if (day < startDay) return null;      // before the diary, not part of it
    var i = index[weekStart(day)];
    return i == null ? null : weeks[i];
  }

  /* Trainer time from `minutes`, the table the rest of the page reads, so the
     log and the year above it can never disagree about a week. */
  var minutes = (archive && archive.minutes) || {};
  var trainerBySource = {};
  Object.keys(minutes).forEach(function (source) {
    var byDay = minutes[source] || {};
    Object.keys(byDay).forEach(function (day) {
      var row = rowFor(day);
      var m = Number(byDay[day]) || 0;
      if (!row || m <= 0) return;
      row.trainer += m;
      row.bySource[source] = (row.bySource[source] || 0) + m;
      trainerBySource[source] = (trainerBySource[source] || 0) + m;
    });
  });

  var bySubject = {};
  visibleStudy(archive).forEach(function (e) {
    var row = rowFor(e.day);
    if (!row) return;
    var k = e.subject.toLowerCase();
    row.study += e.minutes;
    row.bySubject[k] = (row.bySubject[k] || 0) + e.minutes;
    // Newest-first order, so the first spelling met is the latest one used.
    if (!bySubject[k]) bySubject[k] = { subject: e.subject, minutes: 0 };
    bySubject[k].minutes += e.minutes;
  });

  /* The running average is over finished weeks only, and every finished week
     is in it — including the empty ones. */
  var doneMinutes = 0, done = 0;
  weeks.forEach(function (row) {
    row.total = row.trainer + row.study;
    row.met = row.total >= goalMinutes;
    if (!row.current && !row.future) {
      done++;
      doneMinutes += row.total;
      row.runningAverage = doneMinutes / done / 60;
    } else {
      row.runningAverage = null;
    }
  });

  var now = weeks[index[current]] || null;
  var thisWeek = now ? now.total : 0;
  /* What this week needs for the average, once it is finished, to sit on the
     goal: the shortfall carried so far, made up now. Zero when ahead. */
  var needed = Math.max(0, goalMinutes * (done + 1) - doneMinutes - thisWeek);

  return {
    name: diary.name,
    goalHours: diary.goalHours,
    start: startDay,
    startSet: !!diary.start,
    weeks: weeks,
    finished: done,
    average: done ? doneMinutes / done / 60 : null,
    weeksMet: weeks.filter(function (r) { return !r.current && !r.future && r.met; }).length,
    thisWeek: thisWeek / 60,
    thisWeekLeft: Math.max(0, goalMinutes - thisWeek) / 60,
    neededForAverage: needed / 60,
    totals: {
      trainer: sumOf(weeks, "trainer") / 60,
      study: sumOf(weeks, "study") / 60,
      bySource: hoursList(trainerBySource, "source"),
      bySubject: Object.keys(bySubject).map(function (k) {
        return { subject: bySubject[k].subject, hours: bySubject[k].minutes / 60 };
      }).sort(function (a, b) { return b.hours - a.hours; }),
      byMode: modeHours(archive, startDay, last),
    },
  };
}

function sumOf(rows, key) {
  return rows.reduce(function (a, r) { return a + r[key]; }, 0);
}

function hoursList(minutesBy, keyName) {
  return Object.keys(minutesBy).map(function (k) {
    var o = { hours: minutesBy[k] / 60 };
    o[keyName] = k;
    return o;
  }).sort(function (a, b) { return b.hours - a.hours; });
}

/**
 * Hours per mode since the diary began, from the items' own seconds.
 *
 * Read from the records because `minutes` has no modes in it. The two are not
 * the same count — a trainer's clock runs between items too, and some sources
 * time a block rather than an item — so a source's modes are listed beneath
 * its own total and never added up in place of it. What the items do not
 * account for is said, as `unattributed`, instead of being spread across them.
 */
function modeHours(archive, from, toWeek) {
  var until = shiftDay(toWeek, 6);
  var bySource = {};
  ((archive && archive.records) || []).forEach(function (r) {
    if (!r || r.day < from || r.day > until || !(r.seconds > 0)) return;
    var s = bySource[r.source] || (bySource[r.source] = {});
    var label = r.label || "unlabelled";
    s[label] = (s[label] || 0) + r.seconds;
  });
  var minutes = (archive && archive.minutes) || {};
  /* Every source with time in the window, not only those with timed items: a
     trainer that counts minutes and no per-item seconds still trained, and
     leaving it out made its hours vanish from the breakdown while the weeks
     above still counted them. */
  Object.keys(minutes).forEach(function (source) {
    var byDay = minutes[source] || {};
    var any = Object.keys(byDay).some(function (day) {
      return day >= from && day <= until && Number(byDay[day]) > 0;
    });
    if (any && !bySource[source]) bySource[source] = {};
  });
  return Object.keys(bySource).sort().map(function (source) {
    var modes = Object.keys(bySource[source]).map(function (label) {
      return { label: label, hours: bySource[source][label] / 3600 };
    }).sort(function (a, b) { return b.hours - a.hours; });
    var itemHours = modes.reduce(function (a, m) { return a + m.hours; }, 0);
    var clock = 0;
    var byDay = minutes[source] || {};
    Object.keys(byDay).forEach(function (day) {
      if (day >= from && day <= until) clock += Number(byDay[day]) || 0;
    });
    return {
      source: source,
      modes: modes,
      hours: clock / 60,
      unattributed: Math.max(0, clock / 60 - itemHours),
    };
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    makeStudy: makeStudy, studyProblem: studyProblem, studyTombstone: studyTombstone,
    mergeStudy: mergeStudy, visibleStudy: visibleStudy, knownSubjects: knownSubjects,
    makeDiary: makeDiary, mergeDiary: mergeDiary, foldStudy: foldStudy,
    weekStart: weekStart, diaryStart: diaryStart, weeklyLog: weeklyLog,
    DEFAULT_DIARY_NAME: DEFAULT_DIARY_NAME, DEFAULT_GOAL_HOURS: DEFAULT_GOAL_HOURS,
  };
}
