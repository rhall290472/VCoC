// admin-view.js - MM checkbox handling, row visibility, and database updates

function updateMM(entryId, newValue) {
  fetch('update_mm.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'entry_id=' + encodeURIComponent(entryId) + '&mm=' + (newValue ? 1 : 0)
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) {
      alert('Failed to save MM: ' + (data.error || 'Unknown'));
      // Revert checkbox
      const cb = document.querySelector(`input.mm-checkbox[data-entry-id="${entryId}"]`);
      if (cb) cb.checked = !newValue;
    }
  })
  .catch(err => {
    console.error('MM update error:', err);
    alert('Error saving MM');
    const cb = document.querySelector(`input.mm-checkbox[data-entry-id="${entryId}"]`);
    if (cb) cb.checked = !newValue;
  });
}

$(document).ready(function() {
  const $table = $('#entriesTable');

  // Initial hide of rows where MM is checked
  $table.find('tbody tr').each(function() {
    const $row = $(this);
    const $cb = $row.find('input.mm-checkbox');
    if ($cb.length && $cb.is(':checked')) {
      $row.hide();
    }
  });

  // Use delegated event on the table (works even after DataTables redraws)
  $table.on('change', 'input.mm-checkbox', function() {
    const $checkbox = $(this);
    const entryId = $checkbox.data('entry-id');
    const newValue = $checkbox.is(':checked');
    const $row = $checkbox.closest('tr');

    // Save to database
    updateMM(entryId, newValue);

    // Visual hide/show
    if (newValue) {
      $row.fadeOut(400);
    } else {
      $row.fadeIn(400);
    }
  });

  // Toggle visibility of hidden (MM-checked) rows
  $('#showHiddenMM').on('change', function() {
    const show = this.checked;
    $table.find('tbody tr').each(function() {
      const $row = $(this);
      const $cb = $row.find('input.mm-checkbox');
      if ($cb.length && $cb.is(':checked')) {
        show ? $row.fadeIn(300) : $row.fadeOut(300);
      }
    });
  });
});