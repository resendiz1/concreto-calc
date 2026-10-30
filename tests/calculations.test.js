'use strict';

var assert = require('assert');
var D = require('../js/data.js');
var C = require('../js/calculations.js');

function close(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= (tolerance || 1e-9), actual + ' != ' + expected);
}

// Conversión de unidades
close(C.toMeters(100, 'cm'), 1);
close(C.toMeters(1000, 'mm'), 1);
close(C.fromMeters(1, 'cm'), 100);
close(C.convertBetween(2.5, 'm', 'cm'), 250);

// Losa 4 × 3 × 0.10 = 1.2 m³
var losa = C.computeElement({
  elementId: 'losa',
  dims: { largo: 4, ancho: 3, espesor: 0.10 },
  quantity: 1,
  waste: 5,
  rounding: 2,
  dosage: '200'
});
close(losa.volume, 1.2);
close(losa.subtotal, 1.2);
close(losa.wasteVolume, 0.06);
close(losa.finalVolume, 1.26);
close(losa.liters, 1260);
close(losa.cubicFeet, 1.26 * C.CUBIC_FEET_PER_CUBIC_METER);
assert.strictEqual(losa.materials.cementBags, 7);
close(losa.materials.sand, 0.6174);
close(losa.materials.gravel, 0.7434);
close(losa.materials.water, 214.2);

// Cantidad multiplica el volumen
var columnas = C.computeElement({
  elementId: 'columna',
  dims: { altura: 2.7, base: 0.30, peralte: 0.30 },
  quantity: 4,
  waste: 0,
  dosage: '250'
});
close(columnas.volume, 0.243);
close(columnas.subtotal, 0.972);
close(columnas.finalVolume, 0.972);
assert.strictEqual(columnas.materials.cementBags, 6);

// Escalera: escalones + losa
var escalera = C.computeElement({
  elementId: 'escalera',
  dims: { escalones: 12, huella: 0.28, contrahuella: 0.18, ancho: 1, espesorLosa: 0.10 },
  quantity: 1,
  waste: 0,
  dosage: '200'
});
close(escalera.volume, 0.6384);

// Dosificación personalizada
var custom = C.computeElement({
  elementId: 'piso',
  dims: { largo: 5, ancho: 4, espesor: 0.10 },
  quantity: 1,
  waste: 0,
  dosage: 'custom',
  customDosage: { cement: 4.5, sand: 0.5, gravel: 0.6, water: 160 }
});
close(custom.finalVolume, 2);
assert.strictEqual(custom.materials.cementBags, 9);
close(custom.materials.sand, 1);
close(custom.materials.water, 320);

// Costos opcionales
var cost = C.computeElement({
  elementId: 'losa',
  dims: { largo: 2, ancho: 2, espesor: 0.10 },
  quantity: 1,
  waste: 0,
  dosage: '200',
  prices: { cement: 200, sand: 350, gravel: 380, water: 0.05 }
});
close(cost.finalVolume, 0.4);
assert.ok(cost.cost);
close(cost.cost.cement, cost.materials.cementBags * 200);
close(cost.cost.sand, cost.materials.sand * 350);
close(cost.cost.total, cost.cost.cement + cost.cost.sand + cost.cost.gravel + cost.cost.water);

// Sin precios no hay costo
var noCost = C.computeElement({
  elementId: 'losa',
  dims: { largo: 2, ancho: 2, espesor: 0.10 },
  quantity: 1,
  dosage: '200',
  prices: { cement: null, sand: null, gravel: null, water: null }
});
assert.strictEqual(noCost.cost, null);

// Agregados y dimensiones
var items = [
  { elementId: 'losa', unit: 'm', dims: { largo: 4, ancho: 3, espesor: 0.10 }, quantity: 1, result: losa },
  { elementId: 'columna', unit: 'm', dims: { altura: 2.7, base: 0.30, peralte: 0.30 }, quantity: 4, result: columnas }
];
var totals = C.aggregate(items, { cement: 200, sand: null, gravel: null, water: null });
close(totals.finalVolume, 1.26 + 0.972);
assert.strictEqual(totals.materials.cementBags, losa.materials.cementBags + columnas.materials.cementBags);
assert.ok(totals.cost);
close(totals.cost.total, totals.materials.cementBags * 200);

assert.strictEqual(
  C.formatDimensions({ elementId: 'escalera', unit: 'm', dims: { escalones: 12, huella: 0.28, contrahuella: 0.18, ancho: 1, espesorLosa: 0.10 } }, 'm'),
  '12 escalones · 0.28 × 0.18 × 1.00 m · losa 0.10 m'
);

// CSV con BOM, separador y contenido
var csv = C.buildCSV(items, totals, D.DEFAULT_SETTINGS);
assert.strictEqual(csv.charCodeAt(0), 0xFEFF);
assert.ok(csv.indexOf(';') > -1);
assert.ok(csv.indexOf('TOTAL GENERAL') > -1);
assert.ok(csv.indexOf('Cemento (bultos de 50 kg)') > -1);

// Resumen de texto
var summary = C.buildSummaryText(items, totals, D.DEFAULT_SETTINGS);
assert.ok(summary.indexOf('CALCULADORA DE CONCRETO') > -1);
assert.ok(summary.indexOf('TOTAL GENERAL') > -1);

console.log('OK: todas las pruebas de cálculo pasaron.');
