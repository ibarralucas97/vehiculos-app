/* F02/F03 presentation only: existing forms, endpoints and session rules remain authoritative. */
(() => {
  const settings = document.getElementById('settings-modal');
  const vehiclePicker = document.getElementById('settings-vehicle-select');
  window.clearFrontendSettingsContext = () => {
    vehiclePicker.replaceChildren(new Option('Elegir vehículo', ''));
    settings.querySelectorAll('[data-settings-action="vehicle"]').forEach(button => { button.disabled = true; });
  };
  function showSettingsSection(name, focus = false) {
    if (name !== "index" && !document.querySelector(`[data-settings-section="${name}"]`)) return;
    if (name === 'notifications' && getSession()?.role === 'superadmin') name = 'security';
    settings.querySelectorAll('[data-settings-section]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.settingsSection !== name));
    settings.querySelectorAll('.settings-nav [data-settings-target]').forEach(button => {
      if (button.dataset.settingsTarget === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      button.classList.toggle('hidden', button.dataset.settingsTarget === 'notifications' && getSession()?.role === 'superadmin');
    });
    settings.classList.toggle('settings-detail', name !== 'index');
    updateVehicleContext();
    if (focus && name === 'index') settings.querySelector('.settings-nav button')?.focus();
    if (focus && name !== 'index') {
      const heading = settings.querySelector(`[data-settings-section="${name}"] h3`);
      heading?.setAttribute('tabindex', '-1'); heading?.focus();
    }
  }
  function updateVehicleContext() {
    const selected = vehiclePicker.value || String(selectedVehicleId || '');
    vehiclePicker.replaceChildren(new Option('Elegir vehículo', ''));
    currentVehicles.forEach(item => vehiclePicker.add(new Option(item.nombre || 'Vehículo', String(item.id))));
    vehiclePicker.value = selected;
    settings.querySelector('[data-settings-action="vehicle"]').disabled = !vehiclePicker.value;
  }
  vehiclePicker.addEventListener('change', () => {
    settings.querySelector('[data-settings-action="vehicle"]').disabled = !vehiclePicker.value;
  });
  document.addEventListener('click', async event => {
    const menu = event.target.closest('[data-dialog-menu]');
    if (menu) {
      closeModal(menu.closest('.modal').id);
      menuButton.click();
      queueMicrotask(() => menuPanel.querySelector('button:not(.hidden)')?.focus());
      return;
    }
    const theme = event.target.closest('[data-theme-choice]');
    if (theme) window.RodadoAppearance.apply(theme.dataset.themeChoice, true);
    const tab = event.target.closest('[data-settings-target]');
    if (tab) showSettingsSection(tab.dataset.settingsTarget, true);
    const notifications = event.target.closest('[data-open-notification-settings]');
    if (notifications) {
      closeModal('vehicle-reminders-modal');
      const generation = sessionGeneration;
      await openSettingsModal();
      if (generation === sessionGeneration) showSettingsSection('notifications', true);
    }
    const action = event.target.closest('[data-settings-action]')?.dataset.settingsAction;
    if (!action) return;
    const id = Number(vehiclePicker.value || selectedVehicleId);
    if (action === 'vehicle' && !currentVehicles.some(item => Number(item.id) === id)) return;
    closeModal('settings-modal');
    if (action === 'profile') { await openProfileModal(); return; }
    if (action === 'places') { openPlacesModal(); return; }
    if (action === 'vehicle') { selectVehicle(id); return; }
    if (action === 'create-vehicle') { openVehicleCreateModal(); return; }
  });

  // Track visible dialogs without replacing application navigation or resetting forms.
  const dialogs = [...document.querySelectorAll('.modal, .dashboard-section[role="dialog"]')];
  const opened = [];
  const triggers = new WeakMap();
  const visible = dialog => dialog.classList.contains('modal') ? !dialog.classList.contains('hidden') : dialog.classList.contains('open');
  const focusable = dialog => [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
    .filter(node => !node.disabled && node.getClientRects().length && !node.closest('[inert]'));
  const observer = new MutationObserver(() => {
    for (const dialog of dialogs) {
      const index = opened.indexOf(dialog);
      if (visible(dialog) && index < 0) {
        triggers.set(dialog, document.activeElement);
        opened.push(dialog);
        dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        const heading = dialog.querySelector('h2');
        if (heading) { if (!heading.id) heading.id = `${dialog.id}-heading`; dialog.setAttribute('aria-labelledby', heading.id); }
        if (dialog === settings) showSettingsSection(getSession()?.mustChangePassword ? 'security' : 'index');
        if (!dialog.contains(document.activeElement)) focusable(dialog)[0]?.focus();
      } else if (!visible(dialog) && index >= 0) {
        opened.splice(index, 1);
        const trigger = triggers.get(dialog);
        if (dialog === settings) {
          // Do not retain account names in the hidden settings hub after logout.
          window.clearFrontendSettingsContext();
        }
        if (trigger?.isConnected && trigger.getClientRects().length && (!opened.length || opened.at(-1).contains(trigger))) trigger.focus();
      }
    }
  });
  dialogs.forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('keydown', event => {
    const dialog = opened.at(-1);
    if (!dialog || !visible(dialog)) return;
    if (event.key === 'Tab') {
      const nodes = focusable(dialog); const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (dialog.id === 'ui-modal') closeUiModal(false);
      else if (dialog.id === 'maintenance-detail-modal') closeMaintenanceDetail();
      else if (dialog.id === 'maintenance-image-lightbox') closeMaintenanceImageLightbox();
      else if (dialog.classList.contains('dashboard-section')) closeDashboardSections();
      else closeModal(dialog.id);
    }
  }, true);
})();
