document.addEventListener('DOMContentLoaded', () => {
  // Get the 'meet' parameter from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const meet = urlParams.get('meet');  // e.g. "2026-wz-sc" or null

  // Default to something sensible if no ?meet= is provided
  const configFile = meet 
  ? `json/${meet}.json` 
  : 'json/2026-wz-sc.json';  // fallback to your current year

  fetch(configFile)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load ${configFile} – status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // ── Your existing code to populate the page ──
      // Header
      document.title = data.eventName;
      document.getElementById('event-name').textContent = data.eventName;
      document.getElementById('dates-location').textContent = `${data.dates} | ${data.location}`;
      document.getElementById('logo').src = data.logoUrl;

      // Navigation
      const navMenu = document.getElementById('nav-menu');
      data.navigation.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${item.id}`;
        a.textContent = item.text;
        li.appendChild(a);
        navMenu.appendChild(li);
      });

      // Main sections (including the schedule rendering you already have)
      const main = document.getElementById('main-content');
      data.sections.forEach(section => {
        // ... your section creation code ...
      });

      // Schedule (your existing block)
      if (data.schedule) {
        const scheduleSection = document.createElement('section');
        scheduleSection.id = 'schedule';
        scheduleSection.innerHTML = `<h2>${data.schedule.title}</h2><p>${data.schedule.intro || ''}</p>`;

        data.schedule.days.forEach(dayObj => {
          // ... your day rendering code ...
        });

        main.appendChild(scheduleSection);
      }

      // Footer
      document.getElementById('footer-text').textContent = data.footer.text;

    })
    .catch(error => {
      console.error('Error loading config:', error);
      // Show a nice user message instead of alert if preferred
      const main = document.getElementById('main-content');
      main.innerHTML = `<h2>Error</h2><p>Could not load meet configuration (${configFile}).<br>Please check the URL or try again later.</p>`;
    });
});