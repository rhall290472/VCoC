<?php

include '../../config/config.php';
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thurday Prelim Result Viewer</title>
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            padding: 20px;
        }

        #sheetTable {
            margin-top: 20px;
        }

        .loader {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
    </style>
</head>

<body>
    <div class="container">
        <h1>Thursday Prelim Result Viewer</h1>
        <div class="mb-3">
            <label for="sheetSelect" class="form-label">Select a Event:</label>
            <select id="sheetSelect" class="form-select">
                <option value="">Loading events...</option>
            </select>
        </div>
        <div id="loader" class="loader">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        <table id="sheetTable" class="table table-bordered table-striped">
            <thead id="tableHead"></thead>
            <tbody id="tableBody"></tbody>
        </table>
    </div>

    <!-- Bootstrap JS and Popper -->
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.6/dist/umd/popper.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.min.js"></script>
    <script>
        const SPREADSHEET_ID = <?php echo json_encode($SPREADSHEET_ID_THURSDAY); ?>;
        const API_KEY = <?php echo json_encode($ACES_API_KEY); ?>;
        const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

        // DOM Elements
        const sheetSelect = document.getElementById('sheetSelect');
        const tableHead = document.getElementById('tableHead');
        const tableBody = document.getElementById('tableBody');
        const loader = document.getElementById('loader');

        // Initialize
        async function init() {
            try {
                await loadSheetTabs();
                sheetSelect.addEventListener('change', loadSheetData);
            } catch (error) {
                console.error('Initialization error:', error);
                alert('Failed to load sheet tabs. Please check the console for details.');
            }
        }

        // Load all sheet tabs
        async function loadSheetTabs() {
            const response = await fetch(`${API_URL}?key=${API_KEY}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            sheetSelect.innerHTML = '<option value="">Select a tab</option>';
            data.sheets.forEach(sheet => {
                const option = document.createElement('option');
                option.value = sheet.properties.sheetId;
                option.textContent = sheet.properties.title;
                sheetSelect.appendChild(option);
            });
        }

        // Load data for selected sheet
        async function loadSheetData() {
            const sheetId = sheetSelect.value;
            if (!sheetId) {
                tableHead.innerHTML = '';
                tableBody.innerHTML = '';
                return;
            }

            loader.style.display = 'block';
            try {
                // Get sheet title to fetch data
                const sheetTitle = sheetSelect.options[sheetSelect.selectedIndex].text;
                const response = await fetch(`${API_URL}/values/${encodeURIComponent(sheetTitle)}?key=${API_KEY}`);
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                displaySheetData(data.values);
            } catch (error) {
                console.error('Error loading sheet data:', error);
                alert('Failed to load sheet data. Please check the console for details.');
            } finally {
                loader.style.display = 'none';
            }
        }

        // Display sheet data in table
        function displaySheetData(values) {
            tableHead.innerHTML = '';
            tableBody.innerHTML = '';

            if (!values || values.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="100">No data found</td></tr>';
                return;
            }

            // Create header row
            const headerRow = document.createElement('tr');
            values[0].forEach((header, index) => {
                const th = document.createElement('th');
                th.textContent = header || `Column ${index + 1}`;
                headerRow.appendChild(th);
            });
            tableHead.appendChild(headerRow);

            // Create data rows
            values.slice(1).forEach(row => {
                const tr = document.createElement('tr');
                row.forEach(cell => {
                    const td = document.createElement('td');
                    td.textContent = cell || '';
                    tr.appendChild(td);
                });
                // Pad row with empty cells if needed
                while (tr.children.length < values[0].length) {
                    const td = document.createElement('td');
                    tr.appendChild(td);
                }
                tableBody.appendChild(tr);
            });
        }

        // Start initialization
        init();
    </script>
</body>

</html>