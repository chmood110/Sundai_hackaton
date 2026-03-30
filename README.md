# Ink Playground — Análisis Expresivo e Interpretativo de Dibujos Infantiles a partir de Trazos

Aplicación de prototipado desarrollada con React + TypeScript + Vite para la creación de elementos interactivos basados en tinta digital.
Este proyecto extiende el playground original con un nuevo elemento orientado al análisis expresivo e interpretativo de dibujos infantiles a partir de trazos, aprovechando la captura de strokes, la arquitectura de plugins del repositorio, la API de reconocimiento manuscrito y modelos de inferencia mediante OpenRouter.

---

## Propósito del proyecto

El objetivo de este prototipo es analizar dibujos infantiles realizados directamente sobre el lienzo digital, utilizando los trazos capturados para extraer características visuales, construir una representación estructurada del dibujo y generar una interpretación expresiva asistida por modelos.

A diferencia de un enfoque tradicional basado únicamente en procesamiento digital de imágenes y extracción superficial de características, este proyecto busca aprovechar la información propia del trazo digital —como distribución espacial, densidad, longitud, superposición y organización compositiva— para obtener una lectura más rica, contextual y explicable del dibujo.

El sistema no realiza diagnósticos clínicos, psicológicos ni médicos. Su propósito es exclusivamente experimental, interpretativo e interactivo, dentro del marco del hackatón y del ecosistema del Ink Playground.

---

## Características principales

- Captura de trazos en tiempo real sobre un lienzo interactivo.
- Agrupación y procesamiento de strokes para creación de elementos.
- Integración con arquitectura de plugins del proyecto.
- Uso de la API de reconocimiento manuscrito del hackatón.
- Integración con OpenRouter para inferencia y análisis estructurado.
- Nuevo elemento `emotiondrawing` para análisis expresivo de dibujos.
- Conservación de trazos originales junto con la salida interpretativa.
- Visualización dentro del canvas mediante una tarjeta de análisis.

---

## Elemento desarrollado: `emotiondrawing`

Se incorporó un nuevo plugin llamado **EmotionDrawing**, cuyo propósito es interpretar dibujos infantiles a partir de sus trazos y producir una salida estructurada con:

- tono expresivo aparente,
- nivel de energía visual,
- nivel de organización compositiva,
- resumen visual,
- explicación breve y contextual.

La salida del análisis se presenta dentro del mismo lienzo, conservando el dibujo original como parte visible del resultado.

---

## Tecnologías utilizadas

- React
- TypeScript
- Vite
- Canvas API
- OpenRouter
- Handwriting Recognition API
- Arquitectura modular de plugins del Ink Playground

---

## Espacio para imágenes

### Imagen 1 — Vista general del prototipo
![Vista general del prototipo]()

### Imagen 2 — Ejemplo de análisis en 3D
![Ejemplo de análisis en 3D]()

---

## Estructura general del proyecto

```bash
.
├── docs
├── presentation
├── public
├── research
├── src
│   ├── ai
│   ├── canvas
│   ├── elements
│   │   ├── emotiondrawing
│   │   ├── inktext
│   │   ├── tictactoe
│   │   └── ...
│   ├── geometry
│   ├── hooks
│   ├── recognition
│   ├── services
│   ├── state
│   └── types
├── package.json
└── vite.config.ts
```

---

## Requisitos previos

- Node.js v18 o superior
- npm

---

## Instalación

```bash
npm install
```

---

## Configuración del entorno

Copia el archivo de ejemplo y crea tu archivo de entorno local:

```bash
cp .env.example .env.local
```

Configura las variables necesarias:

| Variable | Descripción |
|----------|-------------|
| `INK_RECOGNITION_API_URL` | Endpoint de la API de reconocimiento manuscrito |
| `INK_OPENROUTER_API_KEY` | API key para inferencia mediante OpenRouter |


## Flujo general de funcionamiento

1. El usuario dibuja sobre el lienzo.
2. El sistema captura los strokes generados.
3. Los trazos se agrupan y procesan.
4. Se extraen características geométricas y compositivas.
5. El plugin `emotiondrawing` construye una descripción estructurada del dibujo.
6. Esa representación se envía a OpenRouter para análisis interpretativo.
7. El resultado se devuelve como un nuevo elemento visual dentro del canvas.
8. El dibujo original se conserva junto con la tarjeta de análisis.

---

## Alcance actual del prototipo

Actualmente el proyecto permite:

- detectar dibujos a partir de trazos,
- preservar el dibujo original,
- generar una interpretación expresiva experimental,
- mostrar una respuesta visual dentro de la aplicación.

---

## Limitaciones

- No es una herramienta clínica.
- No debe interpretarse como evaluación psicológica.
- La salida depende de la calidad del trazo y del contexto del dibujo.
- La inferencia está orientada a prototipado y experimentación.
- El análisis puede variar según el modelo utilizado en OpenRouter.

---

## Estado del proyecto

Este repositorio se encuentra en fase de prototipo experimental, enfocado en explorar nuevas formas de interacción ink-native y análisis interpretativo basado en trazos digitales.

---

## Créditos

Proyecto desarrollado sobre la base de Ink Playground, extendido para el hackatón con un enfoque en:

**análisis expresivo e interpretativo de dibujos infantiles a partir de trazos**.