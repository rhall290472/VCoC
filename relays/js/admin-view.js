// admin-view.js - All admin viewer logic (MM checkbox + hide rows)

function updateMM(entryId, newValue) {
  fetch('update_mm.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'entry_id=' + encodeURIComponent(entryId) + '&mm=' + (newValue ? 1 : 0)
  })
  .then(response => {
    if (!response.ok) throw new Error('Network error');
    return response.json();
  })
  .then(data => {
    if (!data.success) {
      alert('Failed to update MM: ' + (data.error || 'Unknown error'));
      // Revert checkbox
      const cb = document.querySelector(`input.mm-checkbox[data-entry-id="${entryId}"]`);
      if (cb) cb.checked = !newValue;
    }
  })
  .catch(err => {
    console.error('Update MM error:', err);
    alert('Connection error — check console');
    // Revert checkbox
    const cb = document.querySelector(`input.mm-checkbox[data-entry-id="${entryId}"]`);
    if (cb) cb.checked = !newValue;
  });
}

$(document).ready(function() {
  const table = $('#entriesTable').DataTable({
    // ... your existing DataTables options ...
    // Make sure NO expand column or click handlers remain
  });

  // === INITIAL HIDE: Hide any rows where MM is already checked ===
  $('#entriesTable tbody tr').each(function() {
    const $row = $(this);
    const $cb = $row.find('input.mm-checkbox');
    if ($cb.is(':checked')) {
      $row.hide();
    }
  });

  // === MAIN: Checkbox change handler ===
  $('#entriesTable tbody').on('change', 'input.mm-checkbox', function(e) {
    e.stopPropagation();  // Critical: prevent DataTables row clicks

    const $checkbox = $(this);
    const entryId = $checkbox.data('entry-id');
    const newValue = $checkbox.is(':checked');
    const $row = $checkbox.closest('tr');

    // Send to server
    updateMM(entryId, newValue);

    // Instantly hide/show row
    if (newValue) {
      $row.fadeOut(400);
    } else {
      $row.fadeIn(400);
    }
  });

  // === FILTERS: Show hidden MM rows checkbox ===
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