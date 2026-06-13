# Mi Notion 📝

Tu propio **Notion open source, local-first y 100% offline**. Todo se guarda en
tu navegador (IndexedDB); no hay servidores, ni cuentas, ni nube. Y puedes
**importar y exportar** tus cosas de Notion.

## ✨ Características

- **Editor de bloques estilo Notion** (texto, encabezados, listas, to-dos,
  citas, código, tablas, imágenes…) gracias a [BlockNote](https://www.blocknotejs.org/).
  Escribe `/` para abrir el menú de bloques.
- **Páginas anidadas** con árbol en la barra lateral (crear, anidar, borrar).
- **Buscador** rápido por título.
- **Offline de verdad**: persistencia local con IndexedDB (Dexie). Cierra el
  navegador y tus notas siguen ahí.
- **Importar desde Notion**: arrastra el `.zip` que Notion genera al exportar en
  formato *Markdown & CSV*. Reconstruye la jerarquía de páginas y hasta incrusta
  las imágenes para que funcionen sin conexión.
- **Exportar todo** a un `.zip` de Markdown (respetando carpetas/jerarquía).

## 🚀 Uso

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Para una versión de producción:

```bash
npm run build
npm run preview
```

## 📥 Cómo importar tu Notion

1. En Notion: `⚙️ Settings` → `Export` (o en una página: `•••` → `Export`).
2. Elige **Markdown & CSV** e incluye subpáginas. Descarga el `.zip`.
3. En Mi Notion, pulsa **⬇ Importar Notion** y selecciona ese `.zip`.

> Nota: las bases de datos de Notion se importan como subpáginas (cada fila es
> una página). Los `.csv` de las vistas de base de datos no se importan como
> tablas todavía.

## 🛠️ Stack

- React 19 + TypeScript + Vite
- BlockNote (editor de bloques)
- Dexie / IndexedDB (almacenamiento offline)
- JSZip (importación/exportación)

## 🔐 Privacidad

Nada sale de tu equipo. Todos los datos viven en el `IndexedDB` de tu navegador.
Haz exportaciones periódicas si quieres copias de seguridad.

## 📂 Estructura

```
src/
  db.ts                 # Esquema y operaciones de IndexedDB (Dexie)
  App.tsx               # Layout principal + importar/exportar
  components/
    Sidebar.tsx         # Árbol de páginas, buscador, acciones
    Editor.tsx          # Editor de bloques (BlockNote)
    PageHeader.tsx      # Título e icono de la página
  lib/
    notion.ts           # Importar zip de Notion / exportar a Markdown
```
