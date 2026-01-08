// admin-view.js - MM checkbox handling and row visibility ONLY
// NO DataTables calls whatsoever!

function updateMM(entryId, newValue) {
  fetch('update_mm.php', {
    method: 'POST',
    credentials: 'same-origin',  // ← THIS IS THE KEY LINE
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'entry_id=' + encodeURIComponent(entryId) + '&mm=' + (newValue ? 1 : 0)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log('MM update response:', data);  // ← Keep this for debugging
    if (!data.success) {
      alert('Failed to save MM: ' + (data.error || 'Unknown'));
      // Revert checkbox
      const cb = document.querySelector(`input.mm-checkbox[data-entry-id="${entryId}"]`);
      if (cb) cb.checked = !newValue;
    }
  })
  .catch(err => {
    console.error('MM update error:', err);
    alert('Connection/error saving MM — check console');
    const cb = document.querySelector(`input.mm-checkbox[data-entry-id="${entryId}"]`);
    if (cb) cb.checked = !newValue;
  });
}

$(document).ready(function() {
  // Initial hide of MM-checked rows
  $('#entriesTable tbody tr').each(function() {
    const $row = $(this);
    const $cb = $row.find('input.mm-checkbox');
    if ($cb.length && $cb.is(':checked')) {
      $row.hide();
    }
  });

  // Checkbox change handler
  $('#entriesTable tbody').on('change', 'input.mm-checkbox', function(e) {
    e.stopPropagation();

    const $checkbox = $(this);
    const entryId = $checkbox.data('entry-id');
    const newValue = $checkbox.is(':checked');
    const $row = $checkbox.closest('tr');

    updateMM(entryId, newValue);

    if (newValue) {
      $row.fadeOut(400);
    } else {
      $row.fadeIn(400);
    }
  });

  // Show/hide hidden MM rows toggle
  $('#showHiddenMM').on('change', function() {
    const show = this.checked;
    $('#entriesTable tbody tr').each(function() {
      const $row = $(this);
      const $cb = $row.find('input.mm-checkbox');
      if ($cb.length && $cb.is(':checked')) {
        show ? $row.fadeIn(300) : $row.fadeOut(300);
      }
    });
  });
});