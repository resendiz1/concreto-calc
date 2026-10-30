(function () {
  'use strict';

  var D = window.ConcretoData;
  var C = window.ConcretoCalc;
  var S = window.ConcretoStorage;
  var X = window.ConcretoExport;

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    settings: S.loadSettings(),
    theme: S.loadTheme(),
    elementId: 'losa',
    unit: S.loadSettings().unit,
    project: S.loadProject(),
    history: S.loadHistory(),
    snapshots: S.loadSnapshots(),
    result: null,
    resultInputs: null,
    editingId: null,
    added: false,
    addedLabel: '',
    confirmResolver: null,
    nameResolver: null,
    settingsTimer: null
  };

  var confirmModal = null;
  var nameModal = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function elementIconHTML(elementId) {
    var element = D.getElement(elementId);
    return '<span class="element-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + element.icon + '</svg></span>';
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (error) {
      return '';
    }
  }

  function toast(message, type) {
    var container = $('toastContainer');
    if (!container || !window.bootstrap) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = '<div class="toast-body"><span class="lamp" aria-hidden="true"></span><span>' + X.escapeHTML(message) + '</span></div>';
    container.appendChild(el);
    var instance = new window.bootstrap.Toast(el, { delay: type === 'error' ? 4600 : 3200 });
    el.addEventListener('hidden.bs.toast', function () { el.remove(); });
    instance.show();
  }

  function getConfirmModal() {
    if (!confirmModal) confirmModal = window.bootstrap.Modal.getOrCreateInstance($('confirmModal'));
    return confirmModal;
  }

  function getNamedModal() {
    if (!nameModal) nameModal = window.bootstrap.Modal.getOrCreateInstance($('nameModal'));
    return nameModal;
  }

  function askConfirm(message, label) {
    return new Promise(function (resolve) {
      state.confirmResolver = resolve;
      $('confirmMessage').textContent = message;
      $('confirmOk').textContent = label || 'Confirmar';
      getConfirmModal().show();
    });
  }

  function askName(defaultValue) {
    return new Promise(function (resolve) {
      state.nameResolver = resolve;
      var input = $('snapshotName');
      input.value = defaultValue || '';
      input.removeAttribute('aria-invalid');
      getNamedModal().show();
    });
  }

  function applyTheme(theme, persist) {
    var next = theme === 'light' ? 'light' : 'dark';
    state.theme = next;
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-bs-theme', next);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#F4F1E8' : '#0B0D0E');
    var button = $('themeToggle');
    if (button) {
      button.setAttribute('aria-label', next === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
      button.setAttribute('title', next === 'light' ? 'Modo oscuro' : 'Modo claro');
    }
    if (persist) S.saveTheme(next);
  }

  function populateDosageSelect() {
    var select = $('dosage');
    select.innerHTML = '';
    D.DOSAGE_LIST.forEach(function (dosage) {
      var option = document.createElement('option');
      option.value = dosage.id;
      option.textContent = dosage.label;
      select.appendChild(option);
    });
    var custom = document.createElement('option');
    custom.value = 'custom';
    custom.textContent = 'Personalizada';
    select.appendChild(custom);
  }

  function renderElementSelector() {
    var wrap = $('elementSelector');
    wrap.innerHTML = '';
    D.ELEMENT_ORDER.forEach(function (id) {
      var element = D.ELEMENTS[id];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'element-tile';
      button.dataset.element = id;
      button.setAttribute('aria-pressed', id === state.elementId ? 'true' : 'false');
      button.innerHTML = elementIconHTML(id) +
        '<span class="element-name">' + X.escapeHTML(element.name) + '</span>' +
        '<span class="element-tagline">' + X.escapeHTML(element.tagline) + '</span>';
      wrap.appendChild(button);
    });
  }

  function updateElementMeta() {
    var element = D.getElement(state.elementId);
    $('elementNote').textContent = element.note;
    $('formFormula').textContent = element.formula;
  }

  function updateUnitUI() {
    document.querySelectorAll('#unitSelector .seg-btn').forEach(function (button) {
      var active = button.dataset.unit === state.unit;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderFields(values) {
    var element = D.getElement(state.elementId);
    var wrap = $('dynamicFields');
    wrap.innerHTML = '';

    element.fields.forEach(function (field) {
      var value = values && Object.prototype.hasOwnProperty.call(values, field.key)
        ? values[field.key]
        : (field.unitless ? field.default : C.fromMeters(field.default, state.unit));
      var col = document.createElement('div');
      col.className = 'col-sm-6 col-xl-4';
      var suffix = field.unitless ? '' : ' <span class="label-unit">' + D.UNITS[state.unit].short + '</span>';
      var inputMarkup;

      if (field.unitless) {
        inputMarkup = '<input class="form-control" id="field-' + field.key + '" data-field="' + field.key + '" type="number" min="' + field.min + '" max="' + field.max + '" step="' + (field.step || 1) + '" inputmode="numeric" value="' + value + '" aria-describedby="field-' + field.key + '-error">';
      } else {
        inputMarkup = '<div class="input-group">' +
          '<input class="form-control" id="field-' + field.key + '" data-field="' + field.key + '" type="number" min="' + field.min + '" max="' + field.max + '" step="any" inputmode="decimal" value="' + value + '" aria-describedby="field-' + field.key + '-error">' +
          '<span class="input-group-text">' + D.UNITS[state.unit].short + '</span>' +
          '</div>';
      }

      col.innerHTML = '<label class="form-label" for="field-' + field.key + '">' + X.escapeHTML(field.label) + suffix + '</label>' +
        inputMarkup +
        '<p class="field-error" id="field-' + field.key + '-error" hidden></p>';
      wrap.appendChild(col);
    });
  }

  function readFieldValues() {
    var element = D.getElement(state.elementId);
    var values = {};
    element.fields.forEach(function (field) {
      var input = $('field-' + field.key);
      values[field.key] = input ? input.value : '';
    });
    return values;
  }

  function changeUnit(newUnit) {
    if (!D.UNITS[newUnit] || newUnit === state.unit) return;
    var oldUnit = state.unit;
    var element = D.getElement(state.elementId);
    var current = readFieldValues();
    var converted = {};

    element.fields.forEach(function (field) {
      var raw = String(current[field.key] || '').trim().replace(',', '.');
      var value = Number(raw);
      if (raw !== '' && Number.isFinite(value)) {
        converted[field.key] = field.unitless ? value : C.convertBetween(value, oldUnit, newUnit);
      }
    });

    state.unit = newUnit;
    state.settings.unit = newUnit;
    updateUnitUI();
    renderFields(converted);
    updateElementMeta();
    invalidateResult();
    scheduleSettingsSave();
  }

  function clearErrors() {
    document.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
    document.querySelectorAll('.field-error').forEach(function (el) {
      el.hidden = true;
      el.textContent = '';
    });
    var formError = $('formError');
    formError.hidden = true;
    formError.textContent = '';
  }

  function setInputError(input, error, message, firstInvalidRef) {
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (!firstInvalidRef.value) firstInvalidRef.value = input;
    }
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function collectInput() {
    clearErrors();
    var element = D.getElement(state.elementId);
    var firstInvalid = { value: null };
    var valid = true;
    var dims = {};

    element.fields.forEach(function (field) {
      var input = $('field-' + field.key);
      var error = $('field-' + field.key + '-error');
      var raw = String(input.value || '').trim().replace(',', '.');
      var value = Number(raw);

      if (raw === '' || !Number.isFinite(value)) {
        valid = false;
        setInputError(input, error, 'Ingresa un valor numérico.', firstInvalid);
        return;
      }

      if (field.unitless && !Number.isInteger(value)) {
        valid = false;
        setInputError(input, error, 'Usa un número entero.', firstInvalid);
        return;
      }

      if (value < field.min || value > field.max) {
        valid = false;
        setInputError(input, error, 'Valor fuera de rango (' + field.min + '–' + field.max + ').', firstInvalid);
        return;
      }

      dims[field.key] = field.unitless ? value : C.toMeters(value, state.unit);
    });

    var quantityInput = $('quantity');
    var quantityRaw = String(quantityInput.value || '').trim();
    var quantity = Number(quantityRaw);
    if (quantityRaw === '' || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      valid = false;
      setInputError(quantityInput, $('quantityError'), 'Ingresa una cantidad entera entre 1 y 9999.', firstInvalid);
    }

    var wasteInput = $('waste');
    var wasteRaw = String(wasteInput.value || '').trim().replace(',', '.');
    var waste = Number(wasteRaw);
    if (wasteRaw === '' || !Number.isFinite(waste) || waste < 0 || waste > 100) {
      valid = false;
      setInputError(wasteInput, $('wasteError'), 'El desperdicio debe estar entre 0 y 100 %.', firstInvalid);
    }

    var rounding = Math.max(0, Math.min(4, Math.floor(Number($('rounding').value) || 0)));
    var dosage = $('dosage').value;
    var customDosage = clone(state.settings.customDosage);

    if (dosage === 'custom') {
      var customInputs = {
        cement: $('customCement'),
        sand: $('customSand'),
        gravel: $('customGravel'),
        water: $('customWater')
      };
      var customValues = {};
      Object.keys(customInputs).forEach(function (key) {
        var input = customInputs[key];
        var raw = String(input.value || '').trim().replace(',', '.');
        var value = Number(raw);
        if (raw === '' || !Number.isFinite(value) || value < 0) {
          valid = false;
          input.setAttribute('aria-invalid', 'true');
          if (!firstInvalid.value) firstInvalid.value = input;
        } else {
          customValues[key] = value;
        }
      });
      if (valid) {
        if (customValues.cement <= 0) {
          valid = false;
          $('customCement').setAttribute('aria-invalid', 'true');
          if (!firstInvalid.value) firstInvalid.value = $('customCement');
        }
        customDosage = customValues;
      }
    }

    if (!valid) {
      var formError = $('formError');
      formError.textContent = 'Revisa los campos marcados. Los datos deben ser números positivos y estar dentro del rango.';
      formError.hidden = false;
      if (firstInvalid.value) firstInvalid.value.focus();
      return { ok: false };
    }

    return {
      ok: true,
      elementId: state.elementId,
      dims: dims,
      quantity: quantity,
      waste: waste,
      rounding: rounding,
      dosage: dosage,
      customDosage: customDosage,
      unit: state.unit
    };
  }

  function makeItem(inputs, result, id) {
    return {
      id: id || uid('p'),
      elementId: inputs.elementId,
      unit: inputs.unit || state.unit,
      dims: clone(inputs.dims),
      quantity: inputs.quantity,
      waste: inputs.waste,
      rounding: inputs.rounding,
      dosage: inputs.dosage,
      customDosage: clone(inputs.customDosage),
      result: result,
      createdAt: new Date().toISOString()
    };
  }

  function renderResult(result) {
    $('resultsEmpty').hidden = true;
    $('resultsContent').hidden = false;

    var element = D.getElement(result.elementId);
    var item = {
      elementId: result.elementId,
      dims: result.dims,
      unit: state.unit
    };

    $('resultFinal').textContent = C.formatNumber(result.finalVolume, result.rounding);
    $('resultLabel').textContent = element.name + ' · ' + result.quantity + (result.quantity === 1 ? ' elemento' : ' elementos') + ' · ' + C.formatDimensions(item, state.unit);
    $('resultIndividual').textContent = C.formatNumber(result.volume, result.rounding);
    $('resultSubtotal').textContent = C.formatNumber(result.subtotal, result.rounding);
    $('resultWaste').textContent = C.formatNumber(result.wasteVolume, result.rounding);
    $('resultLiters').textContent = C.formatNumber(result.liters, Math.min(2, result.rounding));
    $('resultFt3').textContent = C.formatNumber(result.cubicFeet, result.rounding);
    $('resultBags').textContent = C.formatNumber(result.materials.cementBags, 0);
    $('resultDosage').textContent = result.dosageLabel;
    $('resultFormula').textContent = element.formula;
    $('matCement').textContent = C.formatNumber(result.materials.cementBags, 0);
    $('matSand').textContent = C.formatNumber(result.materials.sand, 2);
    $('matGravel').textContent = C.formatNumber(result.materials.gravel, 2);
    $('matWater').textContent = C.formatNumber(result.materials.water, 1);

    if (result.cost) {
      var priced = 0;
      ['cement', 'sand', 'gravel', 'water'].forEach(function (key) {
        if (C.parsePrice(state.settings.prices[key]) !== null) priced += 1;
      });
      $('costBlock').hidden = false;
      $('resultCost').textContent = C.formatCurrency(result.cost.total);
      $('costNote').textContent = priced === 4
        ? 'Incluye los cuatro precios capturados.'
        : 'Solo se suman los materiales con precio capturado.';
    } else {
      $('costBlock').hidden = true;
    }

    updateHero(result);
  }

  function renderEmptyResult() {
    $('resultsEmpty').hidden = false;
    $('resultsContent').hidden = true;
  }

  function updateHero(result) {
    if (!result) return;
    var item = { elementId: result.elementId, dims: result.dims, unit: state.unit };
    $('heroVolume').textContent = C.formatNumber(result.finalVolume, result.rounding);
    $('heroDetail').textContent = D.getElement(result.elementId).name + ' · ' + C.formatDimensions(item, state.unit);
    $('heroBags').textContent = C.formatNumber(result.materials.cementBags, 0);
    $('heroSand').textContent = C.formatNumber(result.materials.sand, 2);
    $('heroGravel').textContent = C.formatNumber(result.materials.gravel, 2);
    $('heroMix').textContent = result.dosageLabel.replace(' kg/cm²', '');
  }

  function updateHeroFromDefaults() {
    var element = D.getElement(state.elementId);
    var dims = {};
    element.fields.forEach(function (field) {
      dims[field.key] = field.default;
    });
    var sample = C.computeElement({
      elementId: state.elementId,
      dims: dims,
      quantity: 1,
      waste: state.settings.waste,
      rounding: state.settings.rounding,
      dosage: state.settings.dosage,
      customDosage: state.settings.customDosage,
      prices: state.settings.prices
    });
    updateHero(sample);
  }

  function invalidateResult() {
    if (state.result) {
      state.result = null;
      state.resultInputs = null;
      state.added = false;
      state.addedLabel = '';
      renderEmptyResult();
    }
    updateAddButton();
  }

  function updateAddButton() {
    var button = $('addToProject');
    var label = $('addToProjectText');
    var calculateLabel = $('calculateBtnText');
    if (state.added) {
      label.textContent = state.addedLabel || 'Agregado al proyecto';
      button.disabled = true;
    } else if (state.editingId) {
      label.textContent = 'Actualizar elemento';
      button.disabled = !state.result;
    } else {
      label.textContent = 'Agregar al proyecto';
      button.disabled = !state.result;
    }
    calculateLabel.textContent = state.editingId ? 'Actualizar cálculo' : 'Calcular';
    $('editingBanner').hidden = !state.editingId;
  }

  function updateEditingUI() {
    $('editingBanner').hidden = !state.editingId;
    updateAddButton();
  }

  function saveSettingsSoon() {
    if (state.settingsTimer) window.clearTimeout(state.settingsTimer);
    state.settingsTimer = window.setTimeout(function () {
      if (!S.saveSettings(state.settings)) toast('No se pudieron guardar las preferencias.', 'error');
    }, 180);
  }

  function scheduleSettingsSave() {
    saveSettingsSoon();
  }

  function onFormInput(event) {
    var target = event.target;
    if (!target || !target.matches('input, select')) return;

    if (target.id === 'waste') {
      var waste = Number(String(target.value).replace(',', '.'));
      if (Number.isFinite(waste)) {
        state.settings.waste = Math.max(0, Math.min(100, waste));
        scheduleSettingsSave();
      }
    } else if (target.id === 'rounding') {
      state.settings.rounding = Math.max(0, Math.min(4, Math.floor(Number(target.value) || 0)));
      scheduleSettingsSave();
    } else if (target.id === 'customCement' || target.id === 'customSand' || target.id === 'customGravel' || target.id === 'customWater') {
      var key = target.id.replace('custom', '').toLowerCase();
      var value = Number(String(target.value).replace(',', '.'));
      if (Number.isFinite(value) && value >= 0) state.settings.customDosage[key] = value;
      scheduleSettingsSave();
    }

    if (target.hasAttribute('aria-invalid')) target.removeAttribute('aria-invalid');
    var error = target.getAttribute('aria-describedby');
    if (error) {
      var errorEl = $(error);
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
    }

    invalidateResult();
  }

  function onDosageChange() {
    var select = $('dosage');
    state.settings.dosage = select.value;
    $('customDosageFields').hidden = select.value !== 'custom';
    if (select.value === 'custom') {
      fillCustomDosage();
    }
    updateDosageTableSelection();
    scheduleSettingsSave();
    invalidateResult();
  }

  function fillCustomDosage() {
    var custom = state.settings.customDosage;
    $('customCement').value = custom.cement;
    $('customSand').value = custom.sand;
    $('customGravel').value = custom.gravel;
    $('customWater').value = custom.water;
  }

  function setDosageUI(dosage, customDosage) {
    if (customDosage) state.settings.customDosage = clone(customDosage);
    $('dosage').value = dosage || state.settings.dosage;
    $('customDosageFields').hidden = $('dosage').value !== 'custom';
    fillCustomDosage();
    updateDosageTableSelection();
  }

  function calculate() {
    var inputs = collectInput();
    if (!inputs.ok) {
      toast('Revisa los datos antes de calcular.', 'error');
      return;
    }

    state.settings.waste = inputs.waste;
    state.settings.rounding = inputs.rounding;
    state.settings.dosage = inputs.dosage;
    state.settings.customDosage = clone(inputs.customDosage);
    scheduleSettingsSave();

    var result = C.computeElement({
      elementId: inputs.elementId,
      dims: inputs.dims,
      quantity: inputs.quantity,
      waste: inputs.waste,
      rounding: inputs.rounding,
      dosage: inputs.dosage,
      customDosage: inputs.customDosage,
      prices: state.settings.prices
    });

    state.result = result;
    state.resultInputs = inputs;
    state.added = false;
    state.addedLabel = '';
    renderResult(result);
    updateAddButton();
    addHistoryEntry(inputs, result);
    toast(state.editingId ? 'Cálculo actualizado. Presiona “Actualizar elemento” para guardar los cambios.' : 'Cálculo listo. Puedes agregarlo al proyecto.');
  }

  function addHistoryEntry(inputs, result) {
    var signature = JSON.stringify({
      elementId: inputs.elementId,
      dims: inputs.dims,
      quantity: inputs.quantity,
      waste: inputs.waste,
      rounding: inputs.rounding,
      dosage: inputs.dosage,
      customDosage: inputs.customDosage
    });
    var entry = {
      id: uid('h'),
      createdAt: new Date().toISOString(),
      elementId: inputs.elementId,
      unit: inputs.unit,
      dims: clone(inputs.dims),
      quantity: inputs.quantity,
      waste: inputs.waste,
      rounding: inputs.rounding,
      dosage: inputs.dosage,
      customDosage: clone(inputs.customDosage),
      signature: signature,
      result: result
    };

    if (state.history[0] && state.history[0].signature === signature) {
      state.history[0] = entry;
    } else {
      state.history.unshift(entry);
    }
    state.history = state.history.slice(0, 30);
    if (!S.saveHistory(state.history)) toast('No se pudo guardar el historial.', 'error');
    renderHistory();
  }

  function addToProject() {
    if (!state.result || !state.resultInputs || state.added) return;

    var editing = Boolean(state.editingId);
    var item = makeItem(state.resultInputs, state.result, state.editingId || undefined);

    if (editing) {
      var index = state.project.findIndex(function (entry) { return entry.id === state.editingId; });
      if (index >= 0) {
        item.createdAt = state.project[index].createdAt || item.createdAt;
        state.project[index] = item;
      } else {
        state.project.push(item);
      }
    } else {
      state.project.push(item);
    }

    state.added = true;
    state.addedLabel = editing ? 'Elemento actualizado' : 'Agregado al proyecto';
    state.editingId = null;
    state.settings.unit = state.unit;
    saveProject();
    renderProject();
    updateEditingUI();
    toast(editing ? 'Elemento actualizado en el proyecto.' : 'Elemento agregado al proyecto.');
  }

  function saveProject() {
    if (!S.saveProject(state.project)) toast('No se pudo guardar el proyecto en este dispositivo.', 'error');
  }

  function startEdit(id) {
    var item = state.project.find(function (entry) { return entry.id === id; });
    if (!item) return;

    state.editingId = id;
    state.elementId = item.elementId;
    state.unit = item.unit || state.settings.unit;
    state.settings.unit = state.unit;
    renderElementSelector();
    updateUnitUI();
    updateElementMeta();

    var element = D.getElement(item.elementId);
    var values = {};
    element.fields.forEach(function (field) {
      var value = item.dims[field.key];
      values[field.key] = field.unitless ? value : C.fromMeters(value, state.unit);
    });
    renderFields(values);

    $('quantity').value = item.quantity;
    $('waste').value = item.waste;
    $('rounding').value = item.rounding;
    setDosageUI(item.dosage, item.customDosage);
    invalidateResult();
    updateEditingUI();
    updateHeroFromDefaults();
    scheduleSettingsSave();

    document.getElementById('calculadora').scrollIntoView({ behavior: 'smooth', block: 'start' });
    var first = $('dynamicFields').querySelector('input');
    if (first) window.setTimeout(function () { first.focus(); }, 380);
    toast('Elemento cargado para edición.');
  }

  function cancelEdit(showToast) {
    if (!state.editingId) return;
    state.editingId = null;
    updateEditingUI();
    invalidateResult();
    updateHeroFromDefaults();
    if (showToast !== false) toast('Edición cancelada.');
  }

  function duplicateItem(id) {
    var item = state.project.find(function (entry) { return entry.id === id; });
    if (!item) return;
    var copy = clone(item);
    copy.id = uid('p');
    copy.createdAt = new Date().toISOString();
    var index = state.project.findIndex(function (entry) { return entry.id === id; });
    state.project.splice(index + 1, 0, copy);
    saveProject();
    renderProject();
    toast('Elemento duplicado.');
  }

  async function deleteItem(id) {
    var item = state.project.find(function (entry) { return entry.id === id; });
    if (!item) return;
    var confirmed = await askConfirm('¿Eliminar “' + D.getElement(item.elementId).name + '” del proyecto? Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmed) return;
    if (state.editingId === id) cancelEdit(false);
    state.project = state.project.filter(function (entry) { return entry.id !== id; });
    saveProject();
    renderProject();
    toast('Elemento eliminado.');
  }

  async function clearProject() {
    if (!state.project.length) return;
    var confirmed = await askConfirm('¿Vaciar todo el proyecto? Se eliminarán todas las partidas guardadas en este dispositivo.', 'Vaciar proyecto');
    if (!confirmed) return;
    state.project = [];
    state.editingId = null;
    saveProject();
    renderProject();
    updateEditingUI();
    toast('Proyecto vaciado.');
  }

  function renderProject() {
    var items = state.project;
    var totals = C.aggregate(items, state.settings.prices);
    var hasItems = items.length > 0;

    $('projectTotal').textContent = C.formatNumber(totals.finalVolume, state.settings.rounding);
    $('projectWaste').textContent = C.formatNumber(totals.wasteVolume, state.settings.rounding);
    $('projectCement').textContent = C.formatNumber(totals.materials.cementBags, 0);
    $('projectCost').textContent = totals.cost ? C.formatCurrency(totals.cost.total) : '—';
    $('projectCount').textContent = items.length + (items.length === 1 ? ' partida' : ' partidas');
    $('projectMatCement').textContent = C.formatNumber(totals.materials.cementBags, 0);
    $('projectMatSand').textContent = C.formatNumber(totals.materials.sand, 2);
    $('projectMatGravel').textContent = C.formatNumber(totals.materials.gravel, 2);
    $('projectMatWater').textContent = C.formatNumber(totals.materials.water, 1);
    $('projectLiters').textContent = C.formatNumber(totals.liters, 0);
    $('projectFt3').textContent = C.formatNumber(totals.cubicFeet, state.settings.rounding);

    $('projectEmpty').hidden = hasItems;
    $('projectContent').hidden = !hasItems;
    $('saveSnapshot').disabled = !hasItems;
    ['exportCsv', 'exportPdf', 'printProject', 'copyProject', 'shareProject', 'clearProject'].forEach(function (id) {
      $(id).disabled = !hasItems;
    });

    if (!hasItems) {
      $('projectBody').innerHTML = '';
      $('projectFoot').innerHTML = '';
      $('compareBars').innerHTML = '';
      return;
    }

    $('projectBody').innerHTML = items.map(function (item) {
      var element = D.getElement(item.elementId);
      var r = item.result;
      return '<tr data-id="' + X.escapeHTML(item.id) + '">' +
        '<td data-label="Elemento"><div class="element-cell">' + elementIconHTML(item.elementId) + '<div><strong>' + X.escapeHTML(element.name) + '</strong><small>' + X.escapeHTML(r.dosageLabel) + '</small></div></div></td>' +
        '<td data-label="Dimensiones" class="dim-cell">' + X.escapeHTML(C.formatDimensions(item, item.unit || state.settings.unit)) + '</td>' +
        '<td data-label="Cantidad" class="num">' + r.quantity + '</td>' +
        '<td data-label="Individual m³" class="num">' + C.formatNumber(r.volume, r.rounding) + '</td>' +
        '<td data-label="Total m³" class="num">' + C.formatNumber(r.subtotal, r.rounding) + '</td>' +
        '<td data-label="Desp. m³" class="num">' + C.formatNumber(r.wasteVolume, r.rounding) + '</td>' +
        '<td data-label="Final m³" class="num"><strong>' + C.formatNumber(r.finalVolume, r.rounding) + '</strong></td>' +
        '<td data-label="Acciones" class="actions-col"><div class="row-actions">' +
        '<button type="button" class="icon-btn" data-action="edit" data-id="' + X.escapeHTML(item.id) + '" title="Editar" aria-label="Editar ' + X.escapeHTML(element.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
        '<button type="button" class="icon-btn" data-action="duplicate" data-id="' + X.escapeHTML(item.id) + '" title="Duplicar" aria-label="Duplicar ' + X.escapeHTML(element.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>' +
        '<button type="button" class="icon-btn danger" data-action="delete" data-id="' + X.escapeHTML(item.id) + '" title="Eliminar" aria-label="Eliminar ' + X.escapeHTML(element.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/></svg></button>' +
        '</div></td>' +
        '</tr>';
    }).join('');

    $('projectFoot').innerHTML = '<tr>' +
      '<td data-label="Total" colspan="3"><strong>TOTAL GENERAL</strong></td>' +
      '<td data-label="Individual m³" class="num">—</td>' +
      '<td data-label="Total m³" class="num">' + C.formatNumber(totals.subtotal, state.settings.rounding) + '</td>' +
      '<td data-label="Desp. m³" class="num">' + C.formatNumber(totals.wasteVolume, state.settings.rounding) + '</td>' +
      '<td data-label="Final m³" class="num">' + C.formatNumber(totals.finalVolume, state.settings.rounding) + '</td>' +
      '<td class="actions-col"></td>' +
      '</tr>';

    var max = items.reduce(function (acc, item) {
      return Math.max(acc, item.result.finalVolume);
    }, 0) || 1;

    $('compareBars').innerHTML = items.map(function (item) {
      var element = D.getElement(item.elementId);
      var width = Math.max(2, (item.result.finalVolume / max) * 100);
      return '<div class="compare-row">' +
        '<div class="compare-name"><strong>' + X.escapeHTML(element.name) + '</strong>' + X.escapeHTML(C.formatDimensions(item, item.unit || state.settings.unit)) + '</div>' +
        '<div class="compare-track"><div class="compare-fill" style="width:' + width.toFixed(2) + '%"></div></div>' +
        '<div class="compare-value">' + C.formatNumber(item.result.finalVolume, state.settings.rounding) + ' m³</div>' +
        '</div>';
    }).join('');
  }

  function renderHistory() {
    $('historyCount').textContent = String(state.history.length);
    $('historyEmpty').hidden = state.history.length > 0;
    $('historyList').innerHTML = state.history.map(function (entry) {
      var element = D.getElement(entry.elementId);
      var item = { elementId: entry.elementId, dims: entry.dims, unit: entry.unit || state.settings.unit };
      return '<div class="history-item" data-id="' + X.escapeHTML(entry.id) + '">' +
        '<div><div class="history-title">' + elementIconHTML(entry.elementId) + '<span>' + X.escapeHTML(element.name) + '</span></div>' +
        '<div class="history-meta">' + X.escapeHTML(formatDate(entry.createdAt)) + ' · ' + X.escapeHTML(C.formatDimensions(item, item.unit)) + ' · ' + X.escapeHTML(entry.result.dosageLabel) + '</div></div>' +
        '<div class="history-side"><span class="history-value">' + C.formatNumber(entry.result.finalVolume, entry.result.rounding) + ' m³</span>' +
        '<div class="history-actions"><button type="button" class="btn-link" data-history-action="load" data-id="' + X.escapeHTML(entry.id) + '">Cargar</button>' +
        '<button type="button" class="btn-link" data-history-action="add" data-id="' + X.escapeHTML(entry.id) + '">Agregar</button>' +
        '<button type="button" class="btn-link danger" data-history-action="delete" data-id="' + X.escapeHTML(entry.id) + '">Eliminar</button></div></div>' +
        '</div>';
    }).join('');
  }

  function renderSnapshots() {
    $('snapshotCount').textContent = String(state.snapshots.length);
    $('snapshotEmpty').hidden = state.snapshots.length > 0;
    $('snapshotList').innerHTML = state.snapshots.map(function (snapshot) {
      var totals = C.aggregate(snapshot.items || [], snapshot.settings ? snapshot.settings.prices : state.settings.prices);
      return '<div class="history-item" data-id="' + X.escapeHTML(snapshot.id) + '">' +
        '<div><div class="history-title"><span class="element-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg></span><span>' + X.escapeHTML(snapshot.name) + '</span></div>' +
        '<div class="history-meta">' + X.escapeHTML(formatDate(snapshot.createdAt)) + ' · ' + (snapshot.items || []).length + ' partidas · ' + C.formatNumber(totals.finalVolume, snapshot.settings ? snapshot.settings.rounding : state.settings.rounding) + ' m³</div></div>' +
        '<div class="history-side"><div class="history-actions"><button type="button" class="btn-link" data-snapshot-action="restore" data-id="' + X.escapeHTML(snapshot.id) + '">Restaurar</button>' +
        '<button type="button" class="btn-link danger" data-snapshot-action="delete" data-id="' + X.escapeHTML(snapshot.id) + '">Eliminar</button></div></div>' +
        '</div>';
    }).join('');
  }

  function renderDosageTable() {
    $('dosageTableBody').innerHTML = D.DOSAGE_LIST.map(function (dosage) {
      return '<tr data-dosage="' + X.escapeHTML(dosage.id) + '" tabindex="0" role="button" aria-label="Usar dosificación ' + X.escapeHTML(dosage.label) + '">' +
        '<td><strong>' + X.escapeHTML(dosage.label) + '</strong><span class="dosage-use">' + X.escapeHTML(dosage.use) + '</span></td>' +
        '<td class="num">' + C.formatNumber(dosage.cement, 1) + '</td>' +
        '<td class="num">' + C.formatNumber(dosage.sand, 2) + '</td>' +
        '<td class="num">' + C.formatNumber(dosage.gravel, 2) + '</td>' +
        '<td class="num">' + C.formatNumber(dosage.water, 0) + '</td>' +
        '</tr>';
    }).join('');
    updateDosageTableSelection();
  }

  function updateDosageTableSelection() {
    document.querySelectorAll('#dosageTableBody tr[data-dosage]').forEach(function (row) {
      row.classList.toggle('is-selected', row.dataset.dosage === $('dosage').value);
    });
  }

  function renderPrices() {
    var map = {
      cement: 'priceCement',
      sand: 'priceSand',
      gravel: 'priceGravel',
      water: 'priceWater'
    };
    Object.keys(map).forEach(function (key) {
      var input = $(map[key]);
      var value = state.settings.prices[key];
      input.value = value === null || value === undefined ? '' : value;
      input.removeAttribute('aria-invalid');
    });
    updatePricesNote();
  }

  function updatePricesNote(forceInvalid) {
    var names = { cement: 'cemento', sand: 'arena', gravel: 'grava', water: 'agua' };
    var active = [];
    Object.keys(names).forEach(function (key) {
      if (C.parsePrice(state.settings.prices[key]) !== null) active.push(names[key]);
    });
    var note = $('pricesNote');
    if (forceInvalid) {
      note.textContent = 'Revisa los precios marcados: deben ser números iguales o mayores a cero.';
      note.style.color = 'var(--c-danger)';
    } else if (!active.length) {
      note.textContent = 'Sin precios capturados.';
      note.style.color = '';
    } else if (active.length === 4) {
      note.textContent = 'Los cuatro precios están activos.';
      note.style.color = '';
    } else {
      note.textContent = 'Precios activos: ' + active.join(', ') + '.';
      note.style.color = '';
    }
  }

  function onPriceInput() {
    var map = {
      cement: 'priceCement',
      sand: 'priceSand',
      gravel: 'priceGravel',
      water: 'priceWater'
    };
    var prices = {};
    var valid = true;

    Object.keys(map).forEach(function (key) {
      var input = $(map[key]);
      var raw = String(input.value || '').trim().replace(',', '.');
      if (raw === '') {
        prices[key] = null;
        input.removeAttribute('aria-invalid');
      } else {
        var value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          valid = false;
          input.setAttribute('aria-invalid', 'true');
          prices[key] = state.settings.prices[key];
        } else {
          prices[key] = value;
          input.removeAttribute('aria-invalid');
        }
      }
    });

    if (!valid) {
      updatePricesNote(true);
      return;
    }

    state.settings.prices = prices;
    scheduleSettingsSave();
    updatePricesNote();

    if (state.result && state.resultInputs) {
      state.result = C.computeElement({
        elementId: state.resultInputs.elementId,
        dims: state.resultInputs.dims,
        quantity: state.resultInputs.quantity,
        waste: state.resultInputs.waste,
        rounding: state.resultInputs.rounding,
        dosage: state.resultInputs.dosage,
        customDosage: state.resultInputs.customDosage,
        prices: state.settings.prices
      });
      renderResult(state.result);
    }
    renderProject();
  }

  function resetPrices() {
    state.settings.prices = { cement: null, sand: null, gravel: null, water: null };
    renderPrices();
    scheduleSettingsSave();
    if (state.result && state.resultInputs) {
      state.result = C.computeElement({
        elementId: state.resultInputs.elementId,
        dims: state.resultInputs.dims,
        quantity: state.resultInputs.quantity,
        waste: state.resultInputs.waste,
        rounding: state.resultInputs.rounding,
        dosage: state.resultInputs.dosage,
        customDosage: state.resultInputs.customDosage,
        prices: state.settings.prices
      });
      renderResult(state.result);
    }
    renderProject();
    toast('Precios eliminados.');
  }

  function renderHelp() {
    var items = D.ELEMENT_ORDER.map(function (id, index) {
      var element = D.ELEMENTS[id];
      var fields = element.fields.map(function (field) {
        return field.label + (field.unitless ? '' : ' (' + D.UNITS[state.unit].short + ')');
      }).join(' · ');
      return '<div class="accordion-item">' +
        '<h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#help-' + id + '" aria-expanded="false" aria-controls="help-' + id + '">' + X.escapeHTML(element.name) + ' — ' + X.escapeHTML(element.tagline) + '</button></h3>' +
        '<div id="help-' + id + '" class="accordion-collapse collapse" data-bs-parent="#helpAccordion"><div class="accordion-body"><p>' + X.escapeHTML(element.note) + '</p><p><strong>Campos:</strong> ' + X.escapeHTML(fields) + '</p><code>' + X.escapeHTML(element.formula) + '</code></div></div>' +
        '</div>';
    }).join('');

    var extras = [
      {
        id: 'unidades',
        title: 'Unidades y conversión',
        body: '<p>Puedes capturar metros, centímetros o milímetros. Al cambiar de unidad, los valores escritos se convierten automáticamente para conservar la misma medida real. Internamente todo se calcula en metros y el volumen final se muestra en m³.</p><code>1 m = 100 cm = 1000 mm · 1 m³ = 1000 L</code>'
      },
      {
        id: 'desperdicio',
        title: 'Desperdicio y redondeo',
        body: '<p>El desperdicio se suma al volumen calculado. Un porcentaje típico de referencia va de 3 % a 10 %, pero depende de la obra, la merma y la forma de colar. El redondeo solo afecta la presentación de los volúmenes; el cemento se redondea siempre hacia arriba porque se compra por bulto completo.</p><code>Volumen final = volumen total × (1 + desperdicio / 100)</code>'
      },
      {
        id: 'dosificaciones',
        title: 'Dosificaciones y materiales',
        body: '<p>Las resistencias de 100 a 300 kg/cm² son referencias aproximadas por m³. La dosificación personalizada permite ajustar bultos de cemento, arena, grava y agua. La cantidad de agua y la relación agua/cemento son determinantes para la resistencia y la trabajabilidad.</p><code>Material = volumen final × consumo por m³</code>'
      },
      {
        id: 'costos',
        title: 'Precios y costos',
        body: '<p>Los precios son opcionales. Si capturas un precio, se multiplica por la cantidad estimada del material. Los campos vacíos no se suman. El resultado es un presupuesto de apoyo y no una cotización formal: confirma precios, fletes, mermas e impuestos con tu proveedor.</p><code>Costo = bultos × precio + arena × precio + grava × precio + agua × precio</code>'
      },
      {
        id: 'datos',
        title: 'Datos, privacidad y respaldo',
        body: '<p>El proyecto, el historial, los precios y el tema se guardan en LocalStorage de este navegador. No se envían a ningún servidor. Si borras los datos del sitio o cambias de dispositivo, la información no estará disponible. Exporta un CSV o imprime el reporte para conservar un respaldo.</p>'
      }
    ];

    var extrasHTML = extras.map(function (item) {
      return '<div class="accordion-item">' +
        '<h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#help-' + item.id + '" aria-expanded="false" aria-controls="help-' + item.id + '">' + X.escapeHTML(item.title) + '</button></h3>' +
        '<div id="help-' + item.id + '" class="accordion-collapse collapse" data-bs-parent="#helpAccordion"><div class="accordion-body">' + item.body + '</div></div>' +
        '</div>';
    }).join('');

    $('helpAccordion').innerHTML = items + extrasHTML;
  }

  function resetForm() {
    state.editingId = null;
    state.unit = state.settings.unit;
    updateUnitUI();
    renderFields();
    updateElementMeta();
    $('quantity').value = 1;
    $('waste').value = state.settings.waste;
    $('rounding').value = state.settings.rounding;
    setDosageUI(state.settings.dosage);
    clearErrors();
    state.result = null;
    state.resultInputs = null;
    state.added = false;
    state.addedLabel = '';
    renderEmptyResult();
    updateEditingUI();
    updateHeroFromDefaults();
    toast('Campos limpiados.');
  }

  function loadHistoryEntry(entry) {
    state.editingId = null;
    state.elementId = entry.elementId;
    state.unit = entry.unit || state.settings.unit;
    state.settings.unit = state.unit;
    state.settings.waste = entry.waste;
    state.settings.rounding = entry.rounding;
    state.settings.dosage = entry.dosage;
    state.settings.customDosage = clone(entry.customDosage);

    renderElementSelector();
    updateUnitUI();
    updateElementMeta();
    var element = D.getElement(entry.elementId);
    var values = {};
    element.fields.forEach(function (field) {
      values[field.key] = field.unitless ? entry.dims[field.key] : C.fromMeters(entry.dims[field.key], state.unit);
    });
    renderFields(values);
    $('quantity').value = entry.quantity;
    $('waste').value = entry.waste;
    $('rounding').value = entry.rounding;
    setDosageUI(entry.dosage, entry.customDosage);
    clearErrors();
    updateEditingUI();

    var inputs = {
      elementId: entry.elementId,
      dims: clone(entry.dims),
      quantity: entry.quantity,
      waste: entry.waste,
      rounding: entry.rounding,
      dosage: entry.dosage,
      customDosage: clone(entry.customDosage),
      unit: state.unit
    };
    state.result = C.computeElement({
      elementId: inputs.elementId,
      dims: inputs.dims,
      quantity: inputs.quantity,
      waste: inputs.waste,
      rounding: inputs.rounding,
      dosage: inputs.dosage,
      customDosage: inputs.customDosage,
      prices: state.settings.prices
    });
    state.resultInputs = inputs;
    state.added = false;
    state.addedLabel = '';
    renderResult(state.result);
    updateAddButton();
    scheduleSettingsSave();
    document.getElementById('calculadora').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Cálculo cargado desde el historial.');
  }

  function addHistoryToProject(entry) {
    var inputs = {
      elementId: entry.elementId,
      dims: clone(entry.dims),
      quantity: entry.quantity,
      waste: entry.waste,
      rounding: entry.rounding,
      dosage: entry.dosage,
      customDosage: clone(entry.customDosage),
      unit: entry.unit || state.settings.unit
    };
    var result = C.computeElement({
      elementId: inputs.elementId,
      dims: inputs.dims,
      quantity: inputs.quantity,
      waste: inputs.waste,
      rounding: inputs.rounding,
      dosage: inputs.dosage,
      customDosage: inputs.customDosage,
      prices: state.settings.prices
    });
    state.project.push(makeItem(inputs, result));
    saveProject();
    renderProject();
    toast('Cálculo agregado al proyecto.');
  }

  function deleteHistoryEntry(id) {
    state.history = state.history.filter(function (entry) { return entry.id !== id; });
    S.saveHistory(state.history);
    renderHistory();
    toast('Cálculo eliminado del historial.');
  }

  async function clearHistory() {
    if (!state.history.length) return;
    var confirmed = await askConfirm('¿Eliminar todos los cálculos del historial? Los proyectos guardados no se borrarán.', 'Limpiar historial');
    if (!confirmed) return;
    state.history = [];
    S.saveHistory(state.history);
    renderHistory();
    toast('Historial limpiado.');
  }

  async function saveSnapshot() {
    if (!state.project.length) {
      toast('Agrega elementos al proyecto antes de guardarlo.', 'error');
      return;
    }
    var defaultName = 'Proyecto ' + new Date().toLocaleDateString('es-MX');
    var name = await askName(defaultName);
    if (!name) return;
    var snapshot = {
      id: uid('s'),
      name: name,
      createdAt: new Date().toISOString(),
      items: clone(state.project),
      settings: clone(state.settings)
    };
    state.snapshots.unshift(snapshot);
    state.snapshots = state.snapshots.slice(0, 10);
    S.saveSnapshots(state.snapshots);
    renderSnapshots();
    toast('Proyecto guardado en el historial.');
  }

  async function restoreSnapshot(id) {
    var snapshot = state.snapshots.find(function (entry) { return entry.id === id; });
    if (!snapshot) return;
    var confirmed = await askConfirm('¿Restaurar “' + snapshot.name + '”? El proyecto actual será reemplazado.', 'Restaurar');
    if (!confirmed) return;
    state.project = clone(snapshot.items || []);
    state.settings = S.mergeSettings(snapshot.settings || state.settings);
    state.unit = state.settings.unit;
    state.editingId = null;
    S.saveProject(state.project);
    S.saveSettings(state.settings);
    applySettingsToForm();
    renderProject();
    updateEditingUI();
    renderHistory();
    toast('Proyecto restaurado.');
  }

  async function deleteSnapshot(id) {
    var snapshot = state.snapshots.find(function (entry) { return entry.id === id; });
    if (!snapshot) return;
    var confirmed = await askConfirm('¿Eliminar el proyecto guardado “' + snapshot.name + '”?', 'Eliminar');
    if (!confirmed) return;
    state.snapshots = state.snapshots.filter(function (entry) { return entry.id !== id; });
    S.saveSnapshots(state.snapshots);
    renderSnapshots();
    toast('Proyecto guardado eliminado.');
  }

  function applySettingsToForm() {
    state.unit = state.settings.unit;
    updateUnitUI();
    renderFields();
    updateElementMeta();
    $('quantity').value = 1;
    $('waste').value = state.settings.waste;
    $('rounding').value = state.settings.rounding;
    setDosageUI(state.settings.dosage);
    renderPrices();
    renderDosageTable();
    clearErrors();
    state.result = null;
    state.resultInputs = null;
    state.added = false;
    state.addedLabel = '';
    renderEmptyResult();
    updateEditingUI();
    updateHeroFromDefaults();
  }

  function getCurrentItem() {
    if (!state.result || !state.resultInputs) return null;
    return makeItem(state.resultInputs, state.result, 'current');
  }

  async function copyCurrentResult() {
    var item = getCurrentItem();
    if (!item) {
      toast('Primero calcula un elemento.', 'error');
      return;
    }
    var totals = C.aggregate([item], state.settings.prices);
    var text = C.buildSummaryText([item], totals, state.settings);
    try {
      await X.copyText(text);
      toast('Resultado copiado al portapapeles.');
    } catch (error) {
      toast('No se pudo copiar el resultado.', 'error');
    }
  }

  async function shareCurrentResult() {
    var item = getCurrentItem();
    if (!item) {
      toast('Primero calcula un elemento.', 'error');
      return;
    }
    var totals = C.aggregate([item], state.settings.prices);
    var text = C.buildSummaryText([item], totals, state.settings);
    var result = await X.shareText('ConcretoCalc — Resultado', text);
    if (result === 'copied') toast('Resumen copiado. Puedes pegarlo donde quieras.');
    else if (result === 'shared') toast('Resultado compartido.');
  }

  function projectSummaryText() {
    var totals = C.aggregate(state.project, state.settings.prices);
    return C.buildSummaryText(state.project, totals, state.settings);
  }

  async function copyProject() {
    if (!state.project.length) {
      toast('El proyecto está vacío.', 'error');
      return;
    }
    try {
      await X.copyText(projectSummaryText());
      toast('Proyecto copiado al portapapeles.');
    } catch (error) {
      toast('No se pudo copiar el proyecto.', 'error');
    }
  }

  async function shareProject() {
    if (!state.project.length) {
      toast('El proyecto está vacío.', 'error');
      return;
    }
    var result = await X.shareText('ConcretoCalc — Proyecto', projectSummaryText());
    if (result === 'copied') toast('Resumen copiado. Puedes pegarlo donde quieras.');
    else if (result === 'shared') toast('Proyecto compartido.');
  }

  function exportProjectCSV() {
    if (!state.project.length) {
      toast('El proyecto está vacío.', 'error');
      return;
    }
    var totals = C.aggregate(state.project, state.settings.prices);
    if (X.exportCSV(state.project, totals, state.settings)) {
      toast('CSV descargado.');
    } else {
      toast('No se pudo generar el CSV.', 'error');
    }
  }

  function printProjectReport() {
    if (!state.project.length) {
      toast('El proyecto está vacío.', 'error');
      return;
    }
    var totals = C.aggregate(state.project, state.settings.prices);
    var html = X.buildPrintReport(state.project, totals, state.settings);
    if (!X.printReport(html)) toast('No se pudo preparar el reporte.', 'error');
  }

  function attachEvents() {
    $('themeToggle').addEventListener('click', function () {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark', true);
    });

    $('elementSelector').addEventListener('click', function (event) {
      var button = event.target.closest('.element-tile');
      if (!button) return;
      var id = button.dataset.element;
      if (!id || id === state.elementId) return;
      if (state.editingId) cancelEdit(false);
      state.elementId = id;
      state.result = null;
      state.resultInputs = null;
      state.added = false;
      state.addedLabel = '';
      renderElementSelector();
      renderFields();
      updateElementMeta();
      renderEmptyResult();
      updateAddButton();
      updateHeroFromDefaults();
      scheduleSettingsSave();
    });

    $('unitSelector').addEventListener('click', function (event) {
      var button = event.target.closest('.seg-btn');
      if (button) changeUnit(button.dataset.unit);
    });

    $('calcForm').addEventListener('submit', function (event) {
      event.preventDefault();
      calculate();
    });

    $('calcForm').addEventListener('input', onFormInput);
    $('calcForm').addEventListener('change', function (event) {
      if (event.target.id === 'dosage') onDosageChange();
    });

    $('clearForm').addEventListener('click', resetForm);
    $('addToProject').addEventListener('click', addToProject);
    $('cancelEdit').addEventListener('click', function () { cancelEdit(true); });
    $('copyResult').addEventListener('click', copyCurrentResult);
    $('shareResult').addEventListener('click', shareCurrentResult);

    ['priceCement', 'priceSand', 'priceGravel', 'priceWater'].forEach(function (id) {
      $(id).addEventListener('input', onPriceInput);
    });
    $('resetPrices').addEventListener('click', resetPrices);
    $('goCustomDosage').addEventListener('click', function () {
      $('dosage').value = 'custom';
      onDosageChange();
      document.getElementById('calculadora').scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(function () { $('customCement').focus(); }, 380);
    });

    $('dosageTableBody').addEventListener('click', function (event) {
      var row = event.target.closest('tr[data-dosage]');
      if (!row) return;
      $('dosage').value = row.dataset.dosage;
      onDosageChange();
    });
    $('dosageTableBody').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var row = event.target.closest('tr[data-dosage]');
      if (!row) return;
      event.preventDefault();
      $('dosage').value = row.dataset.dosage;
      onDosageChange();
    });

    $('projectBody').addEventListener('click', function (event) {
      var button = event.target.closest('[data-action]');
      if (!button) return;
      var action = button.dataset.action;
      var id = button.dataset.id;
      if (action === 'edit') startEdit(id);
      else if (action === 'duplicate') duplicateItem(id);
      else if (action === 'delete') deleteItem(id);
    });

    $('clearProject').addEventListener('click', clearProject);
    $('saveSnapshot').addEventListener('click', saveSnapshot);
    $('exportCsv').addEventListener('click', exportProjectCSV);
    $('exportPdf').addEventListener('click', printProjectReport);
    $('printProject').addEventListener('click', printProjectReport);
    $('copyProject').addEventListener('click', copyProject);
    $('shareProject').addEventListener('click', shareProject);

    $('historyList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-history-action]');
      if (!button) return;
      var entry = state.history.find(function (item) { return item.id === button.dataset.id; });
      if (!entry) return;
      if (button.dataset.historyAction === 'load') loadHistoryEntry(entry);
      else if (button.dataset.historyAction === 'add') addHistoryToProject(entry);
      else if (button.dataset.historyAction === 'delete') deleteHistoryEntry(entry.id);
    });

    $('snapshotList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-snapshot-action]');
      if (!button) return;
      if (button.dataset.snapshotAction === 'restore') restoreSnapshot(button.dataset.id);
      else if (button.dataset.snapshotAction === 'delete') deleteSnapshot(button.dataset.id);
    });

    $('clearHistory').addEventListener('click', clearHistory);

    $('confirmOk').addEventListener('click', function () {
      var resolve = state.confirmResolver;
      state.confirmResolver = null;
      getConfirmModal().hide();
      if (resolve) resolve(true);
    });
    $('confirmModal').addEventListener('hidden.bs.modal', function () {
      if (state.confirmResolver) {
        var resolve = state.confirmResolver;
        state.confirmResolver = null;
        resolve(false);
      }
    });

    $('nameForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('snapshotName');
      var name = input.value.trim();
      if (!name) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      var resolve = state.nameResolver;
      state.nameResolver = null;
      getNamedModal().hide();
      if (resolve) resolve(name);
    });
    $('snapshotName').addEventListener('input', function (event) {
      event.target.removeAttribute('aria-invalid');
    });
    $('nameModal').addEventListener('shown.bs.modal', function () {
      var input = $('snapshotName');
      input.focus();
      input.select();
    });
    $('nameModal').addEventListener('hidden.bs.modal', function () {
      if (state.nameResolver) {
        var resolve = state.nameResolver;
        state.nameResolver = null;
        resolve(null);
      }
    });
  }

  function init() {
    state.unit = state.settings.unit;
    applyTheme(state.theme, false);
    $('footerYear').textContent = new Date().getFullYear();
    populateDosageSelect();
    renderElementSelector();
    renderFields();
    updateElementMeta();
    updateUnitUI();
    $('waste').value = state.settings.waste;
    $('rounding').value = state.settings.rounding;
    setDosageUI(state.settings.dosage);
    renderDosageTable();
    renderPrices();
    renderHelp();
    renderProject();
    renderHistory();
    renderSnapshots();
    renderEmptyResult();
    updateAddButton();
    updateHeroFromDefaults();
    attachEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
