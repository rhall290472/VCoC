console.log('relay-swimmers.js loaded successfully');
document.addEventListener('DOMContentLoaded', function () {
  const teamSelect = document.querySelector('select[name="team"]');
  if (!teamSelect) return;

  // === FIX: Properly initialize TomSelect with create enabled ===
  new TomSelect(teamSelect, {
    maxOptions: null,
    create: true,                    // Allow typing a new team name
    createOnBlur: true,              // Create when user tabs away after typing
    placeholder: 'Select or type your team name...',
    highlight: true,
    maxItems: 1,
    sortField: { field: 'text', direction: 'asc' }  // Optional: keep list sorted
  });

  // ... rest of your existing code (fetching swimmers, etc.) remains unchanged

  // Extract meet_slug from URL (e.g., ?meet=2026-wz-sc or ?meet=csi-state-ag-sc)
  const urlParams = new URLSearchParams(window.location.search);
  //const meet_slug = urlParams.get('meet') || '';
  const meet_slug = document.querySelector('input[name="meet"]').value || '';

  let allSwimmers = { women: [], men: [], mixed: [] };
  let available = { women: [], men: [], mixed: [] };

  /**
   * Fetch swimmers for a team + gender + meet
   */
  async function fetchSwimmers(team, gender) {
    if (!team || !meet_slug) return [];

    const url = new URL('get_swimmers.php', window.location.href);
    url.searchParams.set('team', team);
    url.searchParams.set('gender', gender);
    url.searchParams.set('meet', meet_slug);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${gender} swimmers for ${team} (${meet_slug})`);
        return [];
      }
      return await res.json();
    } catch (err) {
      console.error('Error fetching swimmers:', err);
      return [];
    }
  }

  /**
   * When team changes: reload swimmers for this meet
   */
  teamSelect.addEventListener('change', async function () {
    const team = this.value;

    // Reset swimmer pools
    allSwimmers = { women: [], men: [], mixed: [] };
    available = { women: [], men: [], mixed: [] };

    if (!team) {
      initSwimmers();
      return;
    }

    // Fetch all gender groups in parallel
    const [womenList, menList, mixedList] = await Promise.all([
      fetchSwimmers(team, 'women'),
      fetchSwimmers(team, 'men'),
      fetchSwimmers(team, 'mixed')
    ]);

    // Convert to TomSelect format
    allSwimmers.women = womenList.map(n => ({ value: n, text: n }));
    allSwimmers.men = menList.map(n => ({ value: n, text: n }));
    allSwimmers.mixed = mixedList.map(n => ({ value: n, text: n }));

    // Available starts as full copy
    available.women = [...allSwimmers.women];
    available.men = [...allSwimmers.men];
    available.mixed = [...allSwimmers.mixed];

    initSwimmers();
  });

  /**
   * Initialize or reinitialize all swimmer inputs with TomSelect
   */
function initSwimmers() {
  // Destroy existing instances
  document.querySelectorAll('input.swimmer-input').forEach(el => {
    if (el.tomselect) el.tomselect.destroy();
  });

  // Collect ALL currently filled swimmer names (from DOM) to preserve them
  const preservedValues = new Set();
  document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]')
    .forEach(field => {
      const val = field.value.trim();
      if (val) preservedValues.add(val);
    });

  // Apply TomSelect
  document.querySelectorAll('input[type="text"][name$="_1"], input[type="text"][name$="_2"], input[type="text"][name$="_3"], input[type="text"][name$="_4"]')
    .forEach(input => {
      const name = input.name;
      let gender = 'mixed';
      if (name.startsWith('women_')) gender = 'women';
      else if (name.startsWith('men_')) gender = 'men';

      const baseOptions = available[gender] || [];

      // Ensure any pre-filled value is available as an option, even if not in roster
      const currentValue = input.value.trim();
      const extraOptions = [];
      if (currentValue && !baseOptions.some(opt => opt.value === currentValue)) {
        extraOptions.push({ value: currentValue, text: currentValue });
      }

      const allOptions = [...baseOptions, ...extraOptions];

      new TomSelect(input, {
        options: allOptions,
        items: currentValue ? [currentValue] : [],
        create: true,
        placeholder: 'Swimmer name...',
        load: function (query, callback) {
          if (!query.length) return callback([]);
          const filtered = allOptions.filter(option =>
            option.text.toLowerCase().includes(query.toLowerCase())
          );
          callback(filtered);
        },
        onItemAdd: function (value) {
          value = value.trim();
          // Remove from other fields' dropdowns
          document.querySelectorAll('input.swimmer-input').forEach(other => {
            if (other !== this.input && other.tomselect) {
              other.tomselect.removeOption(value);
            }
          });
        },
        onItemRemove: function (value) {
          value = value.trim();
          // Only restore if it was from original roster
          const original = allSwimmers[gender].find(o => o.value === value);
          if (original) {
            document.querySelectorAll('input.swimmer-input').forEach(other => {
              if (other.tomselect && !other.tomselect.options[value]) {
                other.tomselect.addOption(original);
              }
            });
          }
        }
      });

      // Add a class for easier selection
      input.classList.add('swimmer-input');
    });
}


  // Initial setup
  initSwimmers();

  // If a team is already selected (e.g., edit mode), trigger load
  console.log('Team value on load:', teamSelect.value);
  if (teamSelect.value) {
    setTimeout(() => {
      teamSelect.dispatchEvent(new Event('change'));
    }, 100);
  }
});