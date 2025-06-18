// main.js
import { API_KEY, SPREADSHEET_ID, RANGE } from './config.js';

async function fetchSheetData() {
  const websiteTitle = document.getElementById('website-title');
  const meetDates = document.getElementById('meetDates');
  const vcocTitle = document.getElementById('vcoc-title');
  const button1 = document.getElementById('button1');
  const button2 = document.getElementById('button2');
  const button3 = document.getElementById('button3');
  const errorMessage = document.getElementById('errorMessage');

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`
    );
    const data = await response.json();

    if (data.values) {
      // Extract data from the sheet {R}{C}
      websiteTitle.textContent = data.values[1][1] || 'No Title'; // B2 - Meet Title
      document.title = data.values[1][1] || 'Swim Meet';
      meetDates.textContent = data.values[2][1] || 'No Dates'; // B3 - Meet Dates
      vcocTitle.textContent = 'Virtual Clerk of the Course';

      MRName.textContent = data.values[3][1] || 'No Meet Referee'; // B4 - Meet Referee
      MRPhone.textContent = data.values[4][1] || 'No MR Phone'; // B5 - Meet Referee
      MREmail.textContent = data.values[5][1] || 'No MM Email'; // B6 - Meet Referee

      ARName.textContent = data.values[6][1] || 'No Admin Referee'; // B4 - Meet Referee
      ARPhone.textContent = data.values[7][1] || 'No AR Phone'; // B5 - Meet Referee
      AREmail.textContent = data.values[8][1] || 'No AM Email'; // B6 - Meet Referee

      MDName.textContent = data.values[9][1] || 'No Meet Director'; // B4 - Meet Referee
      MDPhone.textContent = data.values[10][1] || 'No MD Phone'; // B5 - Meet Referee
      MDEmail.textContent = data.values[11][1] || 'No MD Email'; // B6 - Meet Referee


      button1.textContent = 'Day 1 Final Scratch';
      button2.textContent = 'Day 2 Final Scratch';
      button3.textContent = 'Day 3 Final Scratch';

    } else {
      throw new Error('No data found in the specified range.');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    websiteTitle.textContent = 'Error loading configuration';
    errorMessage.classList.remove('d-none');
    errorMessage.textContent = `Failed to load data: ${error.message}`;
  }
}

fetchSheetData();