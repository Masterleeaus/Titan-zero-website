// Front Desk upgrade selector (issue #17). Static and read-only: it totals approved hosted AI prices
// and lists connected apps as quote requests. It never creates a checkout, order or provisioning request.
// Prices must match assets/upgrade-catalogue.json; tests/upgrade-selector.test.mjs checks this.
(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.TitanUpgradeSelector = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  var OPTIONS = [
    { id: 'assistant', name: 'Titan Zero AI Assistant', group: 'ai', monthly: 29, includedIn: 'agent-team' },
    { id: 'agent-team', name: 'Titan Zero AI Agent Team', group: 'ai', monthly: 99 },
    { id: 'supercharged', name: 'SuperchargedAt.Work', group: 'app', monthly: null },
    { id: 'scheduled', name: 'ScheduledAt.Work', group: 'app', monthly: null },
    { id: 'sorted', name: 'SortedAt.Work', group: 'app', monthly: null },
    { id: 'skilled', name: 'SkilledAt.Work', group: 'app', monthly: null }
  ];

  // Returns what the selection means. Pure: no DOM, no network.
  function summarise(selectedIds) {
    var chosen = {};
    OPTIONS.forEach(function (o) { chosen[o.id] = false; });
    (selectedIds || []).forEach(function (id) { if (Object.prototype.hasOwnProperty.call(chosen, id)) chosen[id] = true; });

    var notes = [];
    var billed = [];
    var apps = [];

    OPTIONS.forEach(function (o) {
      if (!chosen[o.id]) return;
      if (o.group === 'app') { apps.push(o); return; }
      if (o.includedIn && chosen[o.includedIn]) return;
      billed.push(o);
    });

    // Agent Team includes the Assistant, so selecting both is billed once at the Agent Team price.
    if (chosen.assistant && chosen['agent-team']) {
      notes.push('Agent Team includes the Assistant, so you are billed once at A$99 per month.');
    }

    var aiMonthly = billed.reduce(function (sum, o) { return sum + o.monthly; }, 0);
    var anyChosen = OPTIONS.some(function (o) { return chosen[o.id]; });
    if (!anyChosen) notes.push('Front Desk Free only. Bookings, calendars and customers need no upgrade.');
    if (apps.length) notes.push('Connected apps are quote requests only. Connections to Front Desk are not live yet.');
    if (billed.length) notes.push('Hosted AI services are in development and not yet available to buy.');

    return {
      ai: billed.map(function (o) { return { id: o.id, name: o.name, monthly: o.monthly }; }),
      aiMonthly: aiMonthly,
      apps: apps.map(function (o) { return { id: o.id, name: o.name }; }),
      notes: notes
    };
  }

  function formatLine(s) {
    var parts = ['Front Desk Free: included, no charge.'];
    if (s.ai.length) {
      parts.push('Hosted AI: ' + s.ai.map(function (a) { return a.name + ' (A$' + a.monthly + ' per month)'; }).join(', ') + '. Subtotal A$' + s.aiMonthly + ' per month, incl. GST.');
    }
    if (s.apps.length) parts.push('Apps: ' + s.apps.map(function (a) { return a.name; }).join(', ') + '. Price on request.');
    return parts.join(' ');
  }

  function init(doc) {
    var form = doc.getElementById('upgrade-selector');
    var out = doc.getElementById('upgrade-selector-summary');
    if (!form || !out) return;
    function render() {
      var picked = [];
      var boxes = form.querySelectorAll('input[type="checkbox"][name="upgrade"]');
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) picked.push(boxes[i].value);
      var s = summarise(picked);
      out.textContent = '';
      var summary = doc.createElement('p');
      summary.textContent = formatLine(s);
      out.appendChild(summary);
      s.notes.forEach(function (n) {
        var p = doc.createElement('p');
        p.className = 'fine-print';
        p.textContent = n;
        out.appendChild(p);
      });
    }
    form.addEventListener('change', render);
    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
    else init(document);
  }

  return { OPTIONS: OPTIONS, summarise: summarise, formatLine: formatLine };
});
