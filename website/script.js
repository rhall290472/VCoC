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

      // Main sections
      const main = document.getElementById('main-content');

      // First, add the info section(s) from JSON
      if (Array.isArray(data.sections)) {
        data.sections.forEach(section => {
          const sec = document.createElement('section');
          sec.id = section.id;
          sec.innerHTML = `<h2>${section.title || ''}</h2>${section.content || ''}`;
          main.appendChild(sec);
        });
      }

      // Schedule
      if (data.schedule) {
        const scheduleSection = document.createElement('section');
        scheduleSection.id = 'schedule';

        let scheduleHTML = `<h2>${data.schedule.title}</h2>`;
        if (data.schedule.intro) {
          scheduleHTML += `<p class="schedule-intro">${data.schedule.intro}</p>`;
        }

        const daysContainer = document.createElement('div');
        daysContainer.className = 'schedule-days';

        data.schedule.days.forEach(dayObj => {
          const dayDiv = document.createElement('div');
          dayDiv.className = 'day';

          dayDiv.innerHTML = `
      <h3>${dayObj.day} <span class="date">${dayObj.date}</span></h3>
    `;

          // Sessions
          if (Array.isArray(dayObj.sessions) && dayObj.sessions.length > 0) {
            const sessionsList = document.createElement('ul');
            sessionsList.className = 'sessions';

            dayObj.sessions.forEach(session => {
              const li = document.createElement('li');
              li.innerHTML = `<strong>${session.time}</strong> — ${session.description}`;
              sessionsList.appendChild(li);
            });

            dayDiv.appendChild(sessionsList);
          }

          // Links (Psych sheets, results, etc.)
          if (Array.isArray(dayObj.links) && dayObj.links.length > 0) {
            const linksDiv = document.createElement('div');
            linksDiv.className = 'day-links';

            dayObj.links.forEach(link => {
              const a = document.createElement('a');
              a.href = link.url;
              a.textContent = link.text;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              linksDiv.appendChild(a);
              linksDiv.appendChild(document.createTextNode('   |   ')); // separator
            });

            // Remove trailing separator
            if (linksDiv.lastChild) {
              linksDiv.removeChild(linksDiv.lastChild);
            }

            dayDiv.appendChild(linksDiv);
          }

          daysContainer.appendChild(dayDiv);
        });

        scheduleSection.innerHTML = scheduleHTML;
        scheduleSection.appendChild(daysContainer);
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