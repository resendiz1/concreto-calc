(function (root) {
  'use strict';

  var D = root.ConcretoData;
  var KEYS = {
    theme: 'concreto.theme.v1',
    project: 'concreto.project.v1',
    history: 'concreto.history.v1',
    snapshots: 'concreto.snapshots.v1',
    settings: 'concreto.settings.v1'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function read(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(key) {
    try {
      root.localStorage.removeItem(key);
    } catch (error) {
      /* noop */
    }
  }

  function mergeSettings(saved) {
    var base = clone(D.DEFAULT_SETTINGS);
    if (!saved || typeof saved !== 'object') return base;
    if (D.UNITS[saved.unit]) base.unit = saved.unit;
    if (Number.isFinite(Number(saved.waste))) base.waste = Math.max(0, Math.min(100, Number(saved.waste)));
    if (Number.isFinite(Number(saved.rounding))) base.rounding = Math.max(0, Math.min(4, Math.floor(Number(saved.rounding))));
    if (saved.dosage === 'custom' || D.DOSAGES[saved.dosage]) base.dosage = saved.dosage;
    if (saved.customDosage && typeof saved.customDosage === 'object') {
      ['cement', 'sand', 'gravel', 'water'].forEach(function (key) {
        if (Number.isFinite(Number(saved.customDosage[key])) && Number(saved.customDosage[key]) >= 0) {
          base.customDosage[key] = Number(saved.customDosage[key]);
        }
      });
    }
    if (saved.prices && typeof saved.prices === 'object') {
      ['cement', 'sand', 'gravel', 'water'].forEach(function (key) {
        var value = saved.prices[key];
        if (value === null || value === undefined || value === '') {
          base.prices[key] = null;
        } else if (Number.isFinite(Number(value)) && Number(value) >= 0) {
          base.prices[key] = Number(value);
        }
      });
    }
    return base;
  }

  function loadSettings() {
    return mergeSettings(read(KEYS.settings, null));
  }

  function saveSettings(settings) {
    return write(KEYS.settings, mergeSettings(settings));
  }

  function loadTheme() {
    var theme = read(KEYS.theme, 'dark');
    return theme === 'light' ? 'light' : 'dark';
  }

  function saveTheme(theme) {
    return write(KEYS.theme, theme === 'light' ? 'light' : 'dark');
  }

  function loadProject() {
    var project = read(KEYS.project, []);
    return Array.isArray(project) ? project : [];
  }

  function saveProject(project) {
    return write(KEYS.project, Array.isArray(project) ? project : []);
  }

  function loadHistory() {
    var history = read(KEYS.history, []);
    return Array.isArray(history) ? history : [];
  }

  function saveHistory(history) {
    return write(KEYS.history, Array.isArray(history) ? history.slice(0, 30) : []);
  }

  function loadSnapshots() {
    var snapshots = read(KEYS.snapshots, []);
    return Array.isArray(snapshots) ? snapshots : [];
  }

  function saveSnapshots(snapshots) {
    return write(KEYS.snapshots, Array.isArray(snapshots) ? snapshots.slice(0, 10) : []);
  }

  root.ConcretoStorage = {
    KEYS: KEYS,
    read: read,
    write: write,
    remove: remove,
    mergeSettings: mergeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadTheme: loadTheme,
    saveTheme: saveTheme,
    loadProject: loadProject,
    saveProject: saveProject,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    loadSnapshots: loadSnapshots,
    saveSnapshots: saveSnapshots
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
