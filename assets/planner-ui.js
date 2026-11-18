/* Titan business planners: page renderer for issues #34-#41.
 * Builds each form from the field definitions in assets/planner-calcs.js.
 * Works fully in the browser: no network request, no storage, no upload.
 * All output is written with textContent, never innerHTML. */
(() => {
  'use strict';
  const P = window.TitanPlanners;
  if (!P) return;

  const numberFormat = (digits) => new Intl.NumberFormat('en-AU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const money = (n) => (n < 0 ? '\u2212' : '') + 'A$' + numberFormat(2).format(Math.abs(n));
  const text = (tag, content, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = content;
    return node;
  };

  // Turns a result cell ({v, f} or plain text) into display text.
  function display(cell) {
    if (cell === null || cell === undefined) return 'Not available';
    if (typeof cell !== 'object') return String(cell);
    const v = cell.v;
    if (v === null || v === undefined) return 'Not available';
    switch (cell.f) {
      case 'money': return money(v);
      case 'pct': return numberFormat(1).format(v) + '%';
      case 'hours': return numberFormat(2).format(v) + ' hours';
      case 'count': return numberFormat(1).format(v);
      case 'count1': return numberFormat(1).format(v);
      case 'km': return numberFormat(1).format(v) + ' km';
      default: return String(v);
    }
  }

  function plainLine(result) {
    const lines = [];
    if (result.headline) lines.push(`${result.headline.label}: ${display(result.headline)}`);
    for (const item of result.summary || []) lines.push(`${item.label}: ${display(item)}`);
    for (const table of result.tables || []) {
      lines.push('', table.caption + ':');
      lines.push(table.headers.join(' | '));
      for (const row of table.rows) lines.push(row.map((c) => (typeof c === 'string' ? c : display(c))).join(' | '));
    }
    if ((result.math || []).length) lines.push('', 'How it is worked out:', ...result.math.map((m) => '- ' + m));
    if ((result.notes || []).length) lines.push('', 'Notes:', ...result.notes.map((n) => '- ' + n));
    return lines.join('\n');
  }

  function fieldControl(f, id, value, { table = false, label = '' } = {}) {
    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      input.id = id;
      input.name = f.key;
      for (const o of f.options) {
        const option = document.createElement('option');
        option.value = o.value;
        option.textContent = o.label;
        option.selected = o.value === value;
        option.defaultSelected = o.value === value;
        input.append(option);
      }
    } else {
      input = document.createElement('input');
      input.id = id;
      input.name = f.key;
      if (f.type === 'text') {
        input.type = 'text';
        input.maxLength = 80;
        input.defaultValue = String(value ?? '');
      } else {
        input.type = 'number';
        input.inputMode = 'decimal';
        input.step = f.type === 'money' ? '0.01' : 'any';
        input.min = String(f.min);
        input.max = String(f.max);
        input.defaultValue = String(value ?? 0);
        input.required = !table;
      }
    }
    if (table) input.setAttribute('aria-label', label);
    return input;
  }

  // Every control carries its group prefix (shared, scenario A/B, settings) so values never mix.
  function fieldWrap(f, id, value, prefix = '') {
    const wrap = document.createElement('div');
    wrap.className = 'tool-field';
    const lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = f.label;
    const control = fieldControl(f, id, value);
    control.dataset.prefix = prefix;
    wrap.append(lab, control);
    if (f.unit) wrap.append(text('small', f.unit));
    return wrap;
  }

  function fieldset(legend) {
    const fs = document.createElement('fieldset');
    fs.className = 'planner-group';
    fs.append(text('legend', legend));
    return fs;
  }

  // Reads one set of fields. Blank number cells become NaN so validation reports them.
  function readFields(root, fields, prefix) {
    const out = {};
    for (const f of fields) {
      const el = root.querySelector(`[name="${f.key}"][data-prefix="${prefix}"]`);
      if (!el) continue;
      out[f.key] = f.type === 'text' || f.type === 'select' ? el.value : (el.value.trim() === '' ? NaN : Number(el.value));
    }
    return out;
  }

  function renderResult(target, title, result) {
    target.replaceChildren();
    target.append(text('p', title, 'eyebrow'));
    if (!result.ok) {
      const p = text('p', result.error, 'planner-error');
      p.setAttribute('role', 'alert');
      target.append(p);
      return;
    }
    if (result.headline) {
      target.append(text('div', display(result.headline), 'metric'), text('h2', result.headline.label));
    }
    if ((result.summary || []).length) {
      const dl = document.createElement('dl');
      dl.className = 'quote-totals';
      for (const item of result.summary) dl.append(text('dt', item.label), text('dd', display(item)));
      target.append(dl);
    }
    for (const table of result.tables || []) {
      const scroller = document.createElement('div');
      scroller.className = 'table-scroller';
      const t = document.createElement('table');
      const caption = text('caption', table.caption);
      t.append(caption);
      const head = document.createElement('thead');
      const hr = document.createElement('tr');
      for (const h of table.headers) hr.append(text('th', h));
      head.append(hr);
      t.append(head);
      const body = document.createElement('tbody');
      for (const row of table.rows) {
        const tr = document.createElement('tr');
        row.forEach((c, i) => {
          const td = text('td', typeof c === 'string' ? c : display(c));
          tr.append(td);
        });
        body.append(tr);
      }
      t.append(body);
      scroller.append(t);
      target.append(scroller);
    }
    if ((result.math || []).length) {
      target.append(text('h3', 'How it is worked out'));
      const ul = document.createElement('ul');
      for (const m of result.math) ul.append(text('li', m));
      target.append(ul);
    }
    if ((result.notes || []).length) {
      target.append(text('h3', 'Read this first'));
      const ul = document.createElement('ul');
      for (const n of result.notes) ul.append(text('li', n));
      target.append(ul);
    }
  }

  function actionRow(target, slug, title, resultText) {
    const row = document.createElement('div');
    row.className = 'button-row result-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'button button-secondary';
    save.textContent = 'Save result as a text file';
    const status = text('p', 'The file is made in this browser and is not uploaded. Review the figures before you share them.', 'fine-print');
    status.setAttribute('role', 'status');
    save.addEventListener('click', () => {
      const blob = new Blob([title + '\n\n' + resultText + '\n'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slug + '-result.txt';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Saved to your device.';
    });
    const print = document.createElement('button');
    print.type = 'button';
    print.className = 'button button-secondary';
    print.textContent = 'Print / save PDF';
    print.addEventListener('click', () => window.print());
    row.append(save, print);
    target.append(row, status);
  }

  function initPlanner(root) {
    const slug = root.dataset.planner;
    const def = P.definitions[slug];
    const form = root.querySelector('[data-planner-form]');
    const fieldsEl = root.querySelector('[data-planner-fields]');
    const result = root.querySelector('[data-planner-result]');
    if (!def || !form || !fieldsEl || !result) return;
    const defaultsOf = (fields) => Object.fromEntries(fields.map((f) => [f.key, f.def]));

    // ---- build the form for each mode -------------------------------------
    if (def.mode === 'single' || def.mode === 'upgrades') {
      const defs = defaultsOf(def.fields);
      if (def.mode === 'upgrades') {
        const group = fieldset('Choose the optional upgrades you are considering');
        const labels = {
          assistant: 'AI Assistant (hosted, optional)',
          agent: 'AI Agent Team (hosted, optional; includes the Assistant)',
          supercharged: 'SuperchargedAt.Work (app upgrade, request quote)',
          scheduled: 'ScheduledAt.Work (app upgrade, request quote)',
          sorted: 'SortedAt.Work (app upgrade, request quote)',
          skilled: 'SkilledAt.Work (app upgrade, request quote)'
        };
        for (const key of def.upgradeKeys) {
          const wrap = document.createElement('div');
          wrap.className = 'planner-check';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.id = `${slug}-${key}`;
          input.name = key;
          input.dataset.prefix = '';
          const lab = document.createElement('label');
          lab.htmlFor = input.id;
          lab.textContent = labels[key];
          wrap.append(input, lab);
          group.append(wrap);
        }
        fieldsEl.append(group);
        const bands = def.fields.filter((f) => f.type === 'select');
        const bandGroup = fieldset('AI workload bands (per month, including GST)');
        for (const f of bands) bandGroup.append(fieldWrap(f, `${slug}-${f.key}`, defs[f.key], ''));
        fieldsEl.append(bandGroup);
        const scenarioGroup = fieldset('Your own scenario (kept separate from fees)');
        for (const f of def.fields.filter((x) => x.type !== 'select')) scenarioGroup.append(fieldWrap(f, `${slug}-${f.key}`, defs[f.key], ''));
        fieldsEl.append(scenarioGroup);
      } else {
        for (const f of def.fields) fieldsEl.append(fieldWrap(f, `${slug}-${f.key}`, defs[f.key], ''));
      }
    } else if (def.mode === 'compare') {
      const shared = fieldset('Shared assumptions (used in both scenarios)');
      for (const f of def.shared) shared.append(fieldWrap(f, `${slug}-s-${f.key}`, f.def, 's'));
      fieldsEl.append(shared);
      def.scenarioLabels.forEach((label, i) => {
        const prefix = i === 0 ? 'a' : 'b';
        const group = fieldset(label);
        for (const f of def.scenarioFields) group.append(fieldWrap(f, `${slug}-${prefix}-${f.key}`, f.def, prefix));
        fieldsEl.append(group);
      });
    } else if (def.mode === 'rows') {
      const globalGroup = fieldset('Settings');
      for (const f of def.globalFields) globalGroup.append(fieldWrap(f, `${slug}-g-${f.key}`, f.def, 'g'));
      fieldsEl.append(globalGroup);
      // One sheet, or two sheets (current and scenario) when scenarioLabels is set.
      const sheets = def.scenarioLabels ? def.scenarioLabels.map((label, si) => ({ label, prefix: si === 0 ? 'a' : 'b' })) : [{ label: null, prefix: 'r' }];
      for (const sheet of sheets) {
        const scroller = document.createElement('div');
        scroller.className = 'table-scroller';
        const table = document.createElement('table');
        table.className = 'planner-sheet';
        table.append(text('caption', def.rowLabel === 'Week' ? 'Enter each week. Blank cells count as zero.' : 'Enter each team. Blank cells count as zero.'));
        const head = document.createElement('thead');
        const hr = document.createElement('tr');
        hr.append(text('th', def.rowLabel));
        for (const f of def.rowFields) hr.append(text('th', f.label));
        head.append(hr);
        table.append(head);
        const body = document.createElement('tbody');
        for (let i = 0; i < def.rowCount; i++) {
          const tr = document.createElement('tr');
          const rowName = slug === 'cash-flow-forecast' ? `Week ${i + 1}` : `Team ${i + 1}`;
          tr.append(text('th', rowName));
          for (const f of def.rowFields) {
            const td = document.createElement('td');
            const id = `${slug}-${sheet.prefix}${i}-${f.key}`;
            const input = fieldControl(f, id, f.def, { table: true, label: `${f.label}, ${rowName}${sheet.label ? ` (${sheet.label})` : ''}` });
            input.dataset.prefix = `${sheet.prefix}${i}`;
            if (f.type !== 'text') input.required = false;
            td.append(input);
            tr.append(td);
          }
          body.append(tr);
        }
        table.append(body);
        scroller.append(table);
        if (sheet.label) {
          const group = fieldset(sheet.label);
          group.append(scroller);
          fieldsEl.append(group);
        } else {
          fieldsEl.append(scroller);
        }
      }
    }

    // ---- read and calculate ---------------------------------------------
    function gather() {
      if (def.mode === 'upgrades') {
        const values = readFields(form, def.fields, '');
        for (const key of def.upgradeKeys) values[key] = form.querySelector(`[name="${key}"]`).checked;
        return values;
      }
      if (def.mode === 'single') return readFields(form, def.fields, '');
      if (def.mode === 'compare') {
        const shared = readFields(form, def.shared, 's');
        const a = readFields(form, def.scenarioFields, 'a');
        const b = readFields(form, def.scenarioFields, 'b');
        return { shared, a: { ...shared, ...a }, b: { ...shared, ...b } };
      }
      // rows: one sheet, or current and scenario sheets that share the settings
      const globals = readFields(form, def.globalFields, 'g');
      const readRows = (p) => {
        const rows = [];
        for (let i = 0; i < def.rowCount; i++) {
          const r = {};
          for (const f of def.rowFields) {
            const el = form.querySelector(`[data-prefix="${p}${i}"][name="${f.key}"]`);
            const raw = el ? el.value : '';
            if (f.type === 'text') r[f.key] = raw;
            else r[f.key] = raw.trim() === '' ? 0 : Number(raw);
          }
          rows.push(r);
        }
        return rows;
      };
      if (def.scenarioLabels) return { a: { ...globals, rows: readRows('a') }, b: { ...globals, rows: readRows('b') } };
      return { ...globals, rows: readRows('r') };
    }

    // Copies plain text to the clipboard only when the user presses the button.
    function handoffButton(target, lines, label) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button button-secondary';
      btn.textContent = label;
      const status = text('p', '', 'fine-print');
      status.setAttribute('role', 'status');
      btn.addEventListener('click', async () => {
        const body = lines.join('\n');
        try {
          await navigator.clipboard.writeText(body);
          status.textContent = 'Copied. Paste it into the capacity planner yourself; nothing was sent.';
        } catch (err) {
          status.textContent = 'Copy is not available in this browser. Select the figures in the table and copy them by hand.';
        }
      });
      target.append(btn, status);
    }

    function calculate(event) {
      event.preventDefault();
      if (def.mode !== 'rows' && !form.reportValidity()) return;
      const values = gather();
      if (def.mode === 'compare' || def.scenarioLabels) {
        const a = def.calc(values.a);
        const b = def.calc(values.b);
        result.replaceChildren();
        result.append(text('p', def.title, 'eyebrow'));
        const sections = [[def.scenarioLabels[0], a], [def.scenarioLabels[1], b]];
        const combined = [];
        for (const [label, r] of sections) {
          const holder = document.createElement('section');
          holder.className = 'planner-section';
          renderResult(holder, label, r);
          if (r.ok && r.handoff && r.handoff.length) {
            const lines = r.handoff.map((h) => `${h.role}: ${h.people} people, ${numberFormat(1).format(h.productivePerPerson)} productive hours each per week`);
            handoffButton(holder, [label, ...lines], `Copy ${label.toLowerCase()} hours for the capacity planner`);
          }
          result.append(holder);
          combined.push(r.ok ? plainLine(r) : r.error);
        }
        if (a.ok && b.ok && def.pair) {
          const pairs = def.pair(a, b);
          const dl = document.createElement('dl');
          dl.className = 'quote-totals';
          for (const item of pairs) dl.append(text('dt', item.label), text('dd', display(item)));
          const holder = document.createElement('section');
          holder.className = 'planner-section';
          holder.append(text('h2', 'Difference between the two scenarios'), dl);
          result.append(holder);
          combined.push(pairs.map((p) => `${p.label}: ${display(p)}`).join('\n'));
        }
        if (a.ok) actionRow(result, slug, def.title, combined.join('\n\n'));
        return;
      }
      const outcome = def.calc(values);
      renderResult(result, def.title, outcome);
      if (outcome.ok) actionRow(result, slug, def.title, plainLine(outcome));
    }

    form.addEventListener('submit', calculate);
    const reset = form.querySelector('[type="reset"]');
    if (reset) reset.addEventListener('click', () => setTimeout(() => result.replaceChildren(text('p', 'Starting values restored. Calculate again to see the result.')), 0));
  }

  document.querySelectorAll('[data-planner]').forEach(initPlanner);
})();
