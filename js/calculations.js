(function (root, factory) {
  var data = (typeof module === 'object' && module.exports) ? require('./data.js') : root.ConcretoData;
  var api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ConcretoCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';

  var CUBIC_FEET_PER_CUBIC_METER = 35.3146667;

  function numberOrZero(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function roundTo(value, decimals) {
    var d = Math.max(0, Math.min(8, Number(decimals) || 0));
    var factor = Math.pow(10, d);
    var rounded = Math.round((numberOrZero(value) + Number.EPSILON) * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function toMeters(value, unit) {
    var u = D.UNITS[unit] || D.UNITS.m;
    return numberOrZero(value) * u.factor;
  }

  function fromMeters(value, unit) {
    var u = D.UNITS[unit] || D.UNITS.m;
    return numberOrZero(value) / u.factor;
  }

  function convertBetween(value, fromUnit, toUnit) {
    return fromMeters(toMeters(value, fromUnit), toUnit);
  }

  function computeVolume(elementId, dims) {
    var element = D.getElement(elementId);
    var d = dims || {};

    if (elementId === 'escalera') {
      var steps = Math.max(0, numberOrZero(d.escalones));
      var tread = Math.max(0, numberOrZero(d.huella));
      var riser = Math.max(0, numberOrZero(d.contrahuella));
      var width = Math.max(0, numberOrZero(d.ancho));
      var slab = Math.max(0, numberOrZero(d.espesorLosa));
      var stepVolume = steps * (tread * riser / 2) * width;
      var slabVolume = steps * tread * width * slab;
      return stepVolume + slabVolume;
    }

    return element.fields.reduce(function (acc, field) {
      return acc * Math.max(0, numberOrZero(d[field.key]));
    }, 1);
  }

  function parsePrice(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function hasPrices(prices) {
    if (!prices) return false;
    return ['cement', 'sand', 'gravel', 'water'].some(function (key) {
      return parsePrice(prices[key]) !== null;
    });
  }

  function computeCost(materials, prices) {
    if (!hasPrices(prices)) return null;
    var p = prices || {};
    var breakdown = {
      cement: parsePrice(p.cement) !== null ? materials.cementBags * parsePrice(p.cement) : 0,
      sand: parsePrice(p.sand) !== null ? materials.sand * parsePrice(p.sand) : 0,
      gravel: parsePrice(p.gravel) !== null ? materials.gravel * parsePrice(p.gravel) : 0,
      water: parsePrice(p.water) !== null ? materials.water * parsePrice(p.water) : 0
    };
    breakdown.total = breakdown.cement + breakdown.sand + breakdown.gravel + breakdown.water;
    return breakdown;
  }

  function computeElement(input) {
    var elementId = input.elementId || 'losa';
    var element = D.getElement(elementId);
    var dims = input.dims || {};
    var quantity = Math.max(1, Math.floor(numberOrZero(input.quantity) || 1));
    var waste = Math.max(0, Math.min(100, numberOrZero(input.waste)));
    var rounding = Math.max(0, Math.min(4, Math.floor(numberOrZero(input.rounding))));
    var dosage = D.getDosage(input.dosage, input.customDosage);

    var volume = computeVolume(elementId, dims);
    var subtotal = volume * quantity;
    var wasteVolume = subtotal * waste / 100;
    var finalVolume = subtotal + wasteVolume;
    var cementBagsExact = finalVolume * dosage.cement;
    var materials = {
      cementBags: Math.ceil(cementBagsExact - 1e-9),
      cementBagsExact: cementBagsExact,
      sand: finalVolume * dosage.sand,
      gravel: finalVolume * dosage.gravel,
      water: finalVolume * dosage.water,
      rates: {
        cement: dosage.cement,
        sand: dosage.sand,
        gravel: dosage.gravel,
        water: dosage.water
      }
    };
    var cost = computeCost(materials, input.prices);

    return {
      elementId: elementId,
      elementName: element.name,
      dims: dims,
      quantity: quantity,
      waste: waste,
      rounding: rounding,
      dosage: dosage.id,
      dosageLabel: dosage.label,
      dosageRates: materials.rates,
      volume: volume,
      subtotal: subtotal,
      wasteVolume: wasteVolume,
      finalVolume: finalVolume,
      liters: finalVolume * 1000,
      cubicFeet: finalVolume * CUBIC_FEET_PER_CUBIC_METER,
      materials: materials,
      cost: cost
    };
  }

  function aggregate(items, prices) {
    var list = items || [];
    var totals = {
      count: list.length,
      volume: 0,
      subtotal: 0,
      wasteVolume: 0,
      finalVolume: 0,
      liters: 0,
      cubicFeet: 0,
      materials: {
        cementBags: 0,
        cementBagsExact: 0,
        sand: 0,
        gravel: 0,
        water: 0
      },
      cost: null
    };

    list.forEach(function (item) {
      var result = item.result;
      if (!result) return;
      totals.volume += numberOrZero(result.volume);
      totals.subtotal += numberOrZero(result.subtotal);
      totals.wasteVolume += numberOrZero(result.wasteVolume);
      totals.finalVolume += numberOrZero(result.finalVolume);
      totals.liters += numberOrZero(result.liters);
      totals.cubicFeet += numberOrZero(result.cubicFeet);
      totals.materials.cementBags += numberOrZero(result.materials.cementBags);
      totals.materials.cementBagsExact += numberOrZero(result.materials.cementBagsExact);
      totals.materials.sand += numberOrZero(result.materials.sand);
      totals.materials.gravel += numberOrZero(result.materials.gravel);
      totals.materials.water += numberOrZero(result.materials.water);
    });

    totals.cost = computeCost(totals.materials, prices);
    return totals;
  }

  function formatNumber(value, decimals) {
    var d = Math.max(0, Math.min(4, Number(decimals) || 0));
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    }).format(numberOrZero(value));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberOrZero(value));
  }

  function formatDimensions(item, unit) {
    var element = D.getElement(item.elementId);
    var dims = item.dims || {};
    var u = unit || item.unit || 'm';
    var unitShort = (D.UNITS[u] || D.UNITS.m).short;
    var fmt = function (value) {
      return formatNumber(fromMeters(value, u), 2);
    };

    if (item.elementId === 'escalera') {
      return formatNumber(dims.escalones, 0) + ' escalones · ' +
        fmt(dims.huella) + ' × ' + fmt(dims.contrahuella) + ' × ' + fmt(dims.ancho) + ' ' + unitShort +
        ' · losa ' + fmt(dims.espesorLosa) + ' ' + unitShort;
    }

    return element.fields.map(function (field) {
      return fmt(dims[field.key]);
    }).join(' × ') + ' ' + unitShort;
  }

  function itemName(item) {
    var element = D.getElement(item.elementId);
    return element.name;
  }

  function buildSummaryText(items, totals, settings) {
    var list = items || [];
    var s = settings || D.DEFAULT_SETTINGS;
    var lines = [];
    lines.push('CALCULADORA DE CONCRETO — RESUMEN');
    lines.push('Fecha: ' + new Date().toLocaleString('es-MX'));
    lines.push('');

    list.forEach(function (item, index) {
      var r = item.result;
      lines.push((index + 1) + '. ' + itemName(item) + ' · ' + formatDimensions(item, item.unit || s.unit));
      lines.push('   Cantidad: ' + r.quantity + ' · Dosificación: ' + r.dosageLabel);
      lines.push('   Volumen individual: ' + formatNumber(r.volume, r.rounding) + ' m³');
      lines.push('   Desperdicio: ' + formatNumber(r.wasteVolume, r.rounding) + ' m³ · Final: ' + formatNumber(r.finalVolume, r.rounding) + ' m³');
    });

    lines.push('');
    lines.push('TOTAL GENERAL');
    lines.push('Concreto final: ' + formatNumber(totals.finalVolume, s.rounding) + ' m³');
    lines.push('Desperdicio: ' + formatNumber(totals.wasteVolume, s.rounding) + ' m³');
    lines.push('Equivalente: ' + formatNumber(totals.liters, 0) + ' L · ' + formatNumber(totals.cubicFeet, s.rounding) + ' ft³');
    lines.push('');
    lines.push('MATERIALES ESTIMADOS');
    lines.push('Cemento: ' + formatNumber(totals.materials.cementBags, 0) + ' bultos de 50 kg');
    lines.push('Arena: ' + formatNumber(totals.materials.sand, 2) + ' m³');
    lines.push('Grava: ' + formatNumber(totals.materials.gravel, 2) + ' m³');
    lines.push('Agua: ' + formatNumber(totals.materials.water, 1) + ' L');
    if (totals.cost) {
      lines.push('Costo estimado: ' + formatCurrency(totals.cost.total) + ' MXN');
    }
    lines.push('');
    lines.push('Estimaciones de apoyo. No sustituyen un diseño estructural ni un estudio de mezcla.');
    return lines.join('\n');
  }

  function csvEscape(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function buildCSV(items, totals, settings) {
    var list = items || [];
    var s = settings || D.DEFAULT_SETTINGS;
    var rows = [];
    var push = function (cells) {
      rows.push(cells.map(csvEscape).join(';'));
    };

    push(['Calculadora de concreto', 'Reporte de proyecto', new Date().toLocaleString('es-MX')]);
    push([]);
    push(['Elemento', 'Dimensiones', 'Cantidad', 'Dosificación', 'Volumen individual (m³)', 'Volumen total (m³)', 'Desperdicio (m³)', 'Volumen final (m³)']);

    list.forEach(function (item) {
      var r = item.result;
      push([
        itemName(item),
        formatDimensions(item, item.unit || s.unit),
        r.quantity,
        r.dosageLabel,
        formatNumber(r.volume, r.rounding),
        formatNumber(r.subtotal, r.rounding),
        formatNumber(r.wasteVolume, r.rounding),
        formatNumber(r.finalVolume, r.rounding)
      ]);
    });

    push([]);
    push(['TOTAL GENERAL']);
    push(['Concreto final (m³)', formatNumber(totals.finalVolume, s.rounding)]);
    push(['Desperdicio (m³)', formatNumber(totals.wasteVolume, s.rounding)]);
    push(['Litros', formatNumber(totals.liters, 0)]);
    push(['Pies cúbicos', formatNumber(totals.cubicFeet, s.rounding)]);
    push([]);
    push(['MATERIALES ESTIMADOS']);
    push(['Cemento (bultos de 50 kg)', formatNumber(totals.materials.cementBags, 0)]);
    push(['Arena (m³)', formatNumber(totals.materials.sand, 2)]);
    push(['Grava (m³)', formatNumber(totals.materials.gravel, 2)]);
    push(['Agua (L)', formatNumber(totals.materials.water, 1)]);
    if (totals.cost) {
      push(['Costo estimado (MXN)', formatCurrency(totals.cost.total)]);
    }
    push([]);
    push(['Aviso', 'Estimaciones de apoyo. No sustituyen un diseño estructural ni un estudio de mezcla.']);

    return '\ufeff' + rows.join('\r\n');
  }

  return {
    CUBIC_FEET_PER_CUBIC_METER: CUBIC_FEET_PER_CUBIC_METER,
    numberOrZero: numberOrZero,
    roundTo: roundTo,
    toMeters: toMeters,
    fromMeters: fromMeters,
    convertBetween: convertBetween,
    computeVolume: computeVolume,
    parsePrice: parsePrice,
    hasPrices: hasPrices,
    computeCost: computeCost,
    computeElement: computeElement,
    aggregate: aggregate,
    formatNumber: formatNumber,
    formatCurrency: formatCurrency,
    formatDimensions: formatDimensions,
    itemName: itemName,
    buildSummaryText: buildSummaryText,
    buildCSV: buildCSV,
    csvEscape: csvEscape
  };
});
