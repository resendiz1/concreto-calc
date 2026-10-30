(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ConcretoData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var UNITS = {
    m: { id: 'm', label: 'Metros', short: 'm', factor: 1 },
    cm: { id: 'cm', label: 'Centímetros', short: 'cm', factor: 0.01 },
    mm: { id: 'mm', label: 'Milímetros', short: 'mm', factor: 0.001 }
  };

  var DOSAGE_LIST = [
    {
      id: '100',
      label: '100 kg/cm²',
      short: '100',
      cement: 3.0,
      sand: 0.55,
      gravel: 0.65,
      water: 140,
      use: 'Plantillas, firmes y trabajos no estructurales.'
    },
    {
      id: '150',
      label: '150 kg/cm²',
      short: '150',
      cement: 4.0,
      sand: 0.52,
      gravel: 0.62,
      water: 155,
      use: 'Pisos, banquetas y elementos de baja exigencia.'
    },
    {
      id: '200',
      label: '200 kg/cm²',
      short: '200',
      cement: 5.0,
      sand: 0.49,
      gravel: 0.59,
      water: 170,
      use: 'Losas, trabes y castillos de vivienda.'
    },
    {
      id: '250',
      label: '250 kg/cm²',
      short: '250',
      cement: 6.0,
      sand: 0.46,
      gravel: 0.56,
      water: 180,
      use: 'Elementos estructurales con mayor solicitación.'
    },
    {
      id: '300',
      label: '300 kg/cm²',
      short: '300',
      cement: 7.0,
      sand: 0.43,
      gravel: 0.53,
      water: 190,
      use: 'Concreto de alta resistencia para obra exigente.'
    }
  ];

  var DOSAGES = {};
  DOSAGE_LIST.forEach(function (d) { DOSAGES[d.id] = d; });

  var CUSTOM_DOSAGE = {
    id: 'custom',
    label: 'Personalizada',
    short: 'Custom',
    cement: 5.0,
    sand: 0.49,
    gravel: 0.59,
    water: 170,
    use: 'Define tu propia dosificación por m³ de concreto.'
  };

  var ELEMENTS = {
    losa: {
      id: 'losa',
      name: 'Losa',
      tagline: 'Superficie rectangular',
      icon: '<path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z"/><path d="M3 8.5v7L12 20l9-4.5v-7"/><path d="M12 13v7"/>',
      fields: [
        { key: 'largo', label: 'Largo', default: 4, min: 0.01, max: 1000 },
        { key: 'ancho', label: 'Ancho', default: 3, min: 0.01, max: 1000 },
        { key: 'espesor', label: 'Espesor', default: 0.10, min: 0.01, max: 100 }
      ],
      formula: 'V = largo × ancho × espesor',
      note: 'Para techos, entrepisos y superficies de concreto.'
    },
    columna: {
      id: 'columna',
      name: 'Columna',
      tagline: 'Sección transversal',
      icon: '<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M8 7h8M8 12h8M8 17h8"/>',
      fields: [
        { key: 'altura', label: 'Altura', default: 2.7, min: 0.01, max: 1000 },
        { key: 'base', label: 'Base', default: 0.30, min: 0.01, max: 100 },
        { key: 'peralte', label: 'Peralte', default: 0.30, min: 0.01, max: 100 }
      ],
      formula: 'V = altura × base × peralte',
      note: 'Elementos verticales que reciben cargas de la estructura.'
    },
    trabe: {
      id: 'trabe',
      name: 'Trabe',
      tagline: 'Viga de concreto',
      icon: '<path d="M3 8h18v8H3z"/><path d="M3 12h18M7 8v8M17 8v8"/>',
      fields: [
        { key: 'largo', label: 'Largo', default: 4, min: 0.01, max: 1000 },
        { key: 'ancho', label: 'Ancho', default: 0.25, min: 0.01, max: 100 },
        { key: 'peralte', label: 'Peralte', default: 0.50, min: 0.01, max: 100 }
      ],
      formula: 'V = largo × ancho × peralte',
      note: 'Vigas horizontales que amarran y soportan la losa.'
    },
    zapata: {
      id: 'zapata',
      name: 'Zapata',
      tagline: 'Cimentación aislada',
      icon: '<path d="M4 9h16l-2 8H6L4 9Z"/><path d="M9 9V5h6v4"/><path d="M7 13h10"/>',
      fields: [
        { key: 'largo', label: 'Largo', default: 1.2, min: 0.01, max: 1000 },
        { key: 'ancho', label: 'Ancho', default: 1.2, min: 0.01, max: 1000 },
        { key: 'peralte', label: 'Peralte', default: 0.30, min: 0.01, max: 100 }
      ],
      formula: 'V = largo × ancho × peralte',
      note: 'Base rectangular que transmite la carga al terreno.'
    },
    castillo: {
      id: 'castillo',
      name: 'Castillo',
      tagline: 'Refuerzo vertical',
      icon: '<rect x="9" y="3" width="6" height="18" rx="1"/><path d="M9 7h6M9 11h6M9 15h6M12 3v18"/>',
      fields: [
        { key: 'altura', label: 'Altura', default: 2.7, min: 0.01, max: 1000 },
        { key: 'ancho', label: 'Ancho', default: 0.15, min: 0.01, max: 100 },
        { key: 'peralte', label: 'Peralte', default: 0.20, min: 0.01, max: 100 }
      ],
      formula: 'V = altura × ancho × peralte',
      note: 'Columnas esbeltas de refuerzo en muros de mampostería.'
    },
    escalera: {
      id: 'escalera',
      name: 'Escalera',
      tagline: 'Huella y contrahuella',
      icon: '<path d="M3 20h5v-4h4v-4h4V8h5"/><path d="M3 20v-2M8 16v-2M12 12v-2M16 8V6"/>',
      fields: [
        { key: 'escalones', label: 'Escalones', default: 12, min: 1, max: 200, unitless: true, step: 1 },
        { key: 'huella', label: 'Huella', default: 0.28, min: 0.01, max: 10 },
        { key: 'contrahuella', label: 'Contrahuella', default: 0.18, min: 0.01, max: 10 },
        { key: 'ancho', label: 'Ancho', default: 1.0, min: 0.01, max: 100 },
        { key: 'espesorLosa', label: 'Espesor de losa', default: 0.10, min: 0, max: 100 }
      ],
      formula: 'V = n × (huella × contrahuella / 2) × ancho + n × huella × ancho × espesor de losa',
      note: 'Estimación de escalones más losa inclinada. Ajusta el espesor según tu proyecto.'
    },
    piso: {
      id: 'piso',
      name: 'Piso / firme',
      tagline: 'Superficie y espesor',
      icon: '<path d="M3 7h18M3 12h18M3 17h18"/><path d="M6 4v16M12 4v16M18 4v16"/>',
      fields: [
        { key: 'largo', label: 'Largo', default: 5, min: 0.01, max: 1000 },
        { key: 'ancho', label: 'Ancho', default: 4, min: 0.01, max: 1000 },
        { key: 'espesor', label: 'Espesor', default: 0.10, min: 0.01, max: 100 }
      ],
      formula: 'V = largo × ancho × espesor',
      note: 'Firmes, pisos industriales y plantillas de nivelación.'
    },
    dado: {
      id: 'dado',
      name: 'Dado',
      tagline: 'Bloque de cimentación',
      icon: '<path d="M4 7 12 3l8 4v10l-8 4-8-4V7Z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
      fields: [
        { key: 'largo', label: 'Largo', default: 0.8, min: 0.01, max: 1000 },
        { key: 'ancho', label: 'Ancho', default: 0.8, min: 0.01, max: 1000 },
        { key: 'altura', label: 'Altura', default: 0.8, min: 0.01, max: 100 }
      ],
      formula: 'V = largo × ancho × altura',
      note: 'Dados de cimentación y bloques de concreto rectangulares.'
    }
  };

  var ELEMENT_ORDER = ['losa', 'columna', 'trabe', 'zapata', 'castillo', 'escalera', 'piso', 'dado'];

  var DEFAULT_SETTINGS = {
    unit: 'm',
    waste: 5,
    rounding: 2,
    dosage: '200',
    customDosage: {
      cement: CUSTOM_DOSAGE.cement,
      sand: CUSTOM_DOSAGE.sand,
      gravel: CUSTOM_DOSAGE.gravel,
      water: CUSTOM_DOSAGE.water
    },
    prices: {
      cement: null,
      sand: null,
      gravel: null,
      water: null
    }
  };

  function getElement(id) {
    return ELEMENTS[id] || ELEMENTS.losa;
  }

  function getDosage(id, custom) {
    if (id === 'custom') {
      var c = custom || {};
      return {
        id: 'custom',
        label: CUSTOM_DOSAGE.label,
        short: CUSTOM_DOSAGE.short,
        cement: Number(c.cement) || 0,
        sand: Number(c.sand) || 0,
        gravel: Number(c.gravel) || 0,
        water: Number(c.water) || 0,
        use: CUSTOM_DOSAGE.use
      };
    }
    return DOSAGES[id] || DOSAGES['200'];
  }

  return {
    UNITS: UNITS,
    DOSAGES: DOSAGES,
    DOSAGE_LIST: DOSAGE_LIST,
    CUSTOM_DOSAGE: CUSTOM_DOSAGE,
    ELEMENTS: ELEMENTS,
    ELEMENT_ORDER: ELEMENT_ORDER,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getElement: getElement,
    getDosage: getDosage
  };
});
