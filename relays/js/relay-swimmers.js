document.addEventListener('DOMContentLoaded', function () {
  const teamSelect = document.querySelector('select[name="team"]');
  if (!teamSelect) return;

  new TomSelect(teamSelect, { maxOptions: null });

  let allSwimmers = { women: [], men: [], mixed: [] };
  let available = { women: [], men: [], mixed: [] };

  async function fetchSwimmers(team, gender) {
    if (!team) return [];
    const res = await fetch(`get_swimmers.php?team=${encodeURIComponent(team)}&gender=${gender}`);
    if (!res.ok) return [];
    return await res.json();
  }

  teamSelect.addEventListener('change', async function () {
    const team = this.value;
    allSwimmers = { women: [], men: [], mixed: [] };
    available = { women: [], men: [], mixed: [] };

    if (!team) {
      initSwimmers();
      return;
    }

    const [w, m, x] = await Promise.all([
      fetchSwimmers(team, 'women'),
      fetchSwimmers(team, 'men'),
      fetchSwimmers(team, 'mixed')
    ]);

    allSwimmers.women = w.map(n => ({ value: n, text: n }));
    allSwimmers.men = m.map(n => ({ value: n, text: n }));
    allSwimmers.mixed = x.map(n => ({ value: n, text: n }));

    available.women = [...allSwimmers.women];
    available.men = [...allSwimmers.men];
    available.mixed = [...allSwimmers.mixed];

    initSwimmers();
  });

  function initSwimmers() {
    document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]').forEach(el => {
      if (el.tomselect) el.tomselect.destroy();
    });

    const used = new Set();

    // Collect pre-filled swimmers
    document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]').forEach(field => {
      if (field.value.trim()) {
        const name = field.value.trim();
        used.add(name);
        // Remove from available (guess gender from name pattern or skip for simplicity)
        // For simplicity, remove from all if needed, but better: use data-attribute or class
      }
    });

    // Simple version without PHP loop issues - use gender from input name
   document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]').forEach(input => {
      const name = input.name;
      let gender = 'mixed';
      if (name.startsWith('women_')) gender = 'women';
      else if (name.startsWith('men_')) gender = 'men';

      const opts = available[gender] || [];

      new TomSelect(input, {
        options: opts,
        items: input.value ? [input.value.trim()] : [],
        create: true,
        placeholder: 'Swimmer name...',
        load: function (q, cb) {
          if (!q.length) return cb([]);
          cb(opts.filter(o => o.text.toLowerCase().includes(q.toLowerCase())));
        },
        onItemAdd: function (val) {
          val = val.trim();
          used.add(val);
          this.settings.placeholder = null;
          this.refreshState();

          const idx = opts.findIndex(o => o.value === val);
          if (idx > -1) opts.splice(idx, 1);

          document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]').forEach(other => {
            if (other !== this.input && other.tomselect) other.tomselect.removeOption(val);
          });
        },
        onItemRemove: function (val) {
          val = val.trim();
          used.delete(val);

          const orig = allSwimmers[gender].find(o => o.value === val);
          if (orig && !opts.some(o => o.value === val)) {
            opts.push(orig);
            opts.sort((a, b) => a.text.localeCompare(b.text));
          }

          document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]').forEach(other => {
            if (other.tomselect && orig && !other.tomselect.options[val]) {
              other.tomselect.addOption(orig);
            }
          });
        },
        onInitialize: function () {
          if (this.items.length) {
            this.settings.placeholder = null;
            this.refreshState();
          }
        }
      });
    });
  }

  initSwimmers();
  if (teamSelect.value) teamSelect.dispatchEvent(new Event('change'));
});