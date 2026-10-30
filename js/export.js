(function (root) {
  'use strict';

  var C = root.ConcretoCalc;
  var D = root.ConcretoData;

  function escapeHTML(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildPrintReport(items, totals, settings) {
    var list = items || [];
    var s = settings || D.DEFAULT_SETTINGS;
    if (!list.length) return '';

    var rows = list.map(function (item, index) {
      var r = item.result;
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td><strong>' + escapeHTML(C.itemName(item)) + '</strong><br><span class="print-dim">' + escapeHTML(C.formatDimensions(item, item.unit || s.unit)) + '</span></td>' +
        '<td class="num">' + r.quantity + '</td>' +
        '<td>' + escapeHTML(r.dosageLabel) + '</td>' +
        '<td class="num">' + C.formatNumber(r.volume, r.rounding) + '</td>' +
        '<td class="num">' + C.formatNumber(r.subtotal, r.rounding) + '</td>' +
        '<td class="num">' + C.formatNumber(r.wasteVolume, r.rounding) + '</td>' +
        '<td class="num strong">' + C.formatNumber(r.finalVolume, r.rounding) + '</td>' +
        '</tr>';
    }).join('');

    var costRows = '';
    if (totals.cost) {
      costRows = '<div class="print-cost">' +
        '<h2>Presupuesto estimado</h2>' +
        '<table class="print-table print-cost-table">' +
        '<thead><tr><th>Concepto</th><th class="num">Importe</th></tr></thead><tbody>' +
        '<tr><td>Cemento (bultos)</td><td class="num">' + C.formatCurrency(totals.cost.cement) + '</td></tr>' +
        '<tr><td>Arena</td><td class="num">' + C.formatCurrency(totals.cost.sand) + '</td></tr>' +
        '<tr><td>Grava</td><td class="num">' + C.formatCurrency(totals.cost.gravel) + '</td></tr>' +
        '<tr><td>Agua</td><td class="num">' + C.formatCurrency(totals.cost.water) + '</td></tr>' +
        '<tr class="print-total-row"><td>Total estimado</td><td class="num">' + C.formatCurrency(totals.cost.total) + '</td></tr>' +
        '</tbody></table>' +
        '</div>';
    }

    return '' +
      '<div class="print-sheet">' +
      '<header class="print-head">' +
      '<div class="print-brand">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7 12 3l8 4v10l-8 4-8-4V7Z"/><path d="m4 7 8 4 8-4M12 11v10"/></svg>' +
      '<div><strong>ConcretoCalc</strong><span>Calculadora de concreto</span></div>' +
      '</div>' +
      '<div class="print-meta"><span>Reporte de proyecto</span><strong>' + escapeHTML(new Date().toLocaleString('es-MX')) + '</strong></div>' +
      '</header>' +
      '<h1>Resumen de concreto y materiales</h1>' +
      '<p class="print-lede">Cálculo de volúmenes, desperdicio y materiales estimados para ' + list.length + ' partida' + (list.length === 1 ? '' : 's') + '.</p>' +
      '<table class="print-table">' +
      '<thead><tr><th>#</th><th>Elemento / dimensiones</th><th class="num">Cant.</th><th>Dosificación</th><th class="num">Individual m³</th><th class="num">Total m³</th><th class="num">Desp. m³</th><th class="num">Final m³</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<div class="print-summary">' +
      '<div><span>Concreto final</span><strong>' + C.formatNumber(totals.finalVolume, s.rounding) + ' m³</strong></div>' +
      '<div><span>Desperdicio</span><strong>' + C.formatNumber(totals.wasteVolume, s.rounding) + ' m³</strong></div>' +
      '<div><span>Equivalente</span><strong>' + C.formatNumber(totals.liters, 0) + ' L · ' + C.formatNumber(totals.cubicFeet, s.rounding) + ' ft³</strong></div>' +
      '</div>' +
      '<h2>Materiales estimados</h2>' +
      '<table class="print-table print-materials">' +
      '<thead><tr><th>Material</th><th class="num">Cantidad</th></tr></thead><tbody>' +
      '<tr><td>Cemento (bultos de 50 kg)</td><td class="num">' + C.formatNumber(totals.materials.cementBags, 0) + '</td></tr>' +
      '<tr><td>Arena</td><td class="num">' + C.formatNumber(totals.materials.sand, 2) + ' m³</td></tr>' +
      '<tr><td>Grava</td><td class="num">' + C.formatNumber(totals.materials.gravel, 2) + ' m³</td></tr>' +
      '<tr><td>Agua</td><td class="num">' + C.formatNumber(totals.materials.water, 1) + ' L</td></tr>' +
      '</tbody></table>' +
      costRows +
      '<footer class="print-foot">' +
      '<p><strong>Aviso:</strong> las cantidades son estimaciones de apoyo y no sustituyen un diseño estructural, un estudio de mezcla ni la supervisión de un profesional. La resistencia real depende de los materiales, la relación agua/cemento y las condiciones de obra.</p>' +
      '<span>Generado con ConcretoCalc · Cálculo local, sin registro.</span>' +
      '</footer>' +
      '</div>';
  }

  function printReport(html) {
    var area = document.getElementById('printArea');
    if (!area || !html) return false;
    area.innerHTML = html;
    var originalTitle = document.title;
    document.title = 'ConcretoCalc — Reporte ' + new Date().toISOString().slice(0, 10);
    document.body.classList.add('is-printing');

    var cleanup = function () {
      document.body.classList.remove('is-printing');
      document.title = originalTitle;
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
    return true;
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportCSV(items, totals, settings) {
    if (!items || !items.length) return false;
    var content = C.buildCSV(items, totals, settings);
    var date = new Date().toISOString().slice(0, 10);
    downloadFile('concreto-' + date + '.csv', content, 'text/csv;charset=utf-8');
    return true;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) resolve();
        else reject(new Error('No se pudo copiar'));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  function shareText(title, text) {
    if (navigator.share) {
      return navigator.share({ title: title, text: text }).then(function () {
        return 'shared';
      }).catch(function (error) {
        if (error && error.name === 'AbortError') return 'cancelled';
        return copyText(text).then(function () { return 'copied'; });
      });
    }
    return copyText(text).then(function () { return 'copied'; });
  }

  root.ConcretoExport = {
    escapeHTML: escapeHTML,
    buildPrintReport: buildPrintReport,
    printReport: printReport,
    downloadFile: downloadFile,
    exportCSV: exportCSV,
    copyText: copyText,
    shareText: shareText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
