# ConcretoCalc

Calculadora de concreto para obra residencial y pequeña obra. Calcula volúmenes, desperdicio, materiales y costos estimados para ocho elementos constructivos. Funciona por completo en el navegador, sin backend, sin registro y sin peticiones a internet en tiempo de ejecución.

La aplicación se abre directamente desde `index.html` y guarda el proyecto, el historial y las preferencias en `localStorage`.

## Características

- Ocho elementos: losa, columna, trabe, zapata, castillo, escalera, piso/firme y dado.
- Unidades de entrada en metros, centímetros o milímetros, con conversión automática.
- Cantidad de elementos, porcentaje de desperdicio y redondeo configurable.
- Dosificaciones de referencia de 100 a 300 kg/cm² y mezcla personalizada.
- Cálculo de cemento, arena, grava y agua por partida y por proyecto.
- Presupuesto opcional con precios unitarios de los cuatro materiales.
- Proyecto editable: agregar, editar, duplicar, eliminar y vaciar partidas.
- Historial de cálculos y snapshots del proyecto.
- Exportación a CSV y reporte imprimible en PDF mediante la impresión nativa del navegador.
- Copiar y compartir resúmenes de texto.
- Tema oscuro y claro, diseño responsive y recursos locales.
- Sin dependencias de red: Bootstrap, fuentes e iconos se sirven desde el propio proyecto.

## Uso rápido

1. Abre `index.html` en un navegador moderno.
2. Elige el elemento, captura las dimensiones y presiona **Calcular**.
3. Revisa volumen, materiales y costo.
4. Presiona **Agregar al proyecto** para acumular partidas.
5. Exporta el proyecto a CSV o genera el reporte PDF desde la sección **Proyecto**.

También puedes servir el proyecto con un servidor local:

```bash
python3 -m http.server 8765
```

Y abrir `http://127.0.0.1:8765/index.html`.

## Elementos y fórmulas

Todos los cálculos internos se realizan en metros. El volumen se multiplica por la cantidad de elementos y después se le suma el desperdicio.

| Elemento | Fórmula del volumen individual |
| --- | --- |
| Losa | largo × ancho × espesor |
| Columna | altura × base × peralte |
| Trabe | largo × ancho × peralte |
| Zapata | largo × ancho × peralte |
| Castillo | altura × ancho × peralte |
| Escalera | n × (huella × contrahuella / 2) × ancho + n × huella × ancho × espesor de losa |
| Piso / firme | largo × ancho × espesor |
| Dado | largo × ancho × altura |

Fórmulas generales:

```text
Volumen subtotal    = volumen individual × cantidad
Volumen desperdicio = volumen subtotal × desperdicio / 100
Volumen final       = volumen subtotal + volumen desperdicio
Material            = volumen final × consumo por m³
```

## Dosificaciones de referencia

Consumos aproximados por metro cúbico de concreto:

| Resistencia | Cemento (bultos de 50 kg) | Arena (m³) | Grava (m³) | Agua (L) |
| --- | ---: | ---: | ---: | ---: |
| 100 kg/cm² | 3.0 | 0.55 | 0.65 | 140 |
| 150 kg/cm² | 4.0 | 0.52 | 0.62 | 155 |
| 200 kg/cm² | 5.0 | 0.49 | 0.59 | 170 |
| 250 kg/cm² | 6.0 | 0.46 | 0.56 | 180 |
| 300 kg/cm² | 7.0 | 0.43 | 0.53 | 190 |

La opción **Personalizada** permite definir bultos de cemento, arena, grava y agua por m³.

Reglas de presentación:

- Los bultos de cemento siempre se redondean hacia arriba.
- Arena y grava se muestran con dos decimales.
- El agua se muestra con un decimal.
- El costo se calcula con las cantidades exactas de material, no con las cantidades redondeadas que se muestran en pantalla.

## Materiales y costos

Los precios son opcionales. Si un precio está vacío, ese material no se suma al presupuesto. La moneda del presupuesto es MXN.

```text
Costo = bultos × precio del cemento
      + arena × precio de la arena
      + grava × precio de la grava
      + agua × precio del agua
```

El resultado es una estimación de apoyo. No incluye fletes, impuestos, mermas adicionales ni mano de obra.

## Persistencia local

La aplicación no envía datos a ningún servidor. La información se guarda en el navegador con estas claves:

| Clave | Contenido |
| --- | --- |
| `concreto.theme.v1` | Tema oscuro o claro |
| `concreto.project.v1` | Partidas del proyecto actual |
| `concreto.history.v1` | Historial de cálculos (máximo 30) |
| `concreto.snapshots.v1` | Proyectos guardados (máximo 10) |
| `concreto.settings.v1` | Unidad, desperdicio, redondeo, dosificación y precios |

Si se borran los datos del sitio o se cambia de navegador/dispositivo, la información no estará disponible. Para conservar un respaldo, exporta el CSV o imprime el reporte.

## Exportación

- **CSV:** archivo separado por punto y coma, con BOM UTF-8 para abrir correctamente en hojas de cálculo.
- **PDF:** se genera con el diálogo de impresión del navegador. En el diálogo elige “Guardar como PDF”. El reporte incluye partidas, totales, materiales y presupuesto.
- **Copiar/Compartir:** usa la API de portapapeles o la hoja de compartir del sistema cuando está disponible.

## Estructura del proyecto

```text
calculadora_concreto/
├── index.html
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── calculations.js
│   ├── data.js
│   ├── export.js
│   └── storage.js
├── tests/
│   └── calculations.test.js
└── vendor/
    ├── bootstrap/
    │   ├── bootstrap.min.css
    │   └── bootstrap.bundle.min.js
    └── fonts/
        ├── archivo-latin.woff2
        ├── archivo-latin-italic.woff2
        └── jetbrains-mono-latin.woff2
```

## Pruebas

Pruebas de cálculo y sintaxis:

```bash
node tests/calculations.test.js
node --check js/data.js
node --check js/calculations.js
node --check js/storage.js
node --check js/export.js
node --check js/app.js
```

La verificación de navegador se realizó con Chrome headless: flujo funcional completo, persistencia, CSV, PDF, responsive y revisión de contraste, etiquetas y objetivos táctiles.

Checklist manual recomendada:

1. Calcular una losa de 4 × 3 × 0.10 m con 5 % de desperdicio y verificar 1.26 m³.
2. Cambiar entre metros, centímetros y milímetros y confirmar que las medidas se conviertan.
3. Agregar, editar, duplicar y eliminar partidas del proyecto.
4. Capturar precios y verificar el costo en el resultado y en el proyecto.
5. Recargar la página y confirmar que proyecto, historial, tema, unidad y precios persisten.
6. Exportar el CSV y generar el PDF desde el diálogo de impresión.
7. Probar el menú móvil y el tema claro/oscuro.

## Compatibilidad

Probado en Google Chrome. Requiere un navegador moderno con JavaScript, `localStorage`, CSS Grid y variables CSS. Algunos efectos de transparencia pueden variar en navegadores antiguos. La aplicación funciona sin conexión porque todos los recursos son locales.

## Aviso

Las cantidades y costos son estimaciones de apoyo. No sustituyen un diseño estructural, un estudio de mezcla, la supervisión de un profesional ni una cotización formal. Confirma dosificaciones, resistencia, precios, fletes e impuestos con tu proveedor o responsable técnico.

## Tecnologías

- HTML, CSS y JavaScript sin framework de aplicación.
- Bootstrap 5.3.3 (MIT).
- Tipografías Archivo y JetBrains Mono (SIL Open Font License).
- Almacenamiento local del navegador.
