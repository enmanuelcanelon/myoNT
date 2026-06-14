# EAC Blessed ✦

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

Para una versión de producción (web):

```bash
npm run build
npm run preview
```

## 🖥️ App de escritorio (Tauri)

EAC Blessed también funciona como **aplicación de escritorio nativa** (con
[Tauri](https://tauri.app/)), sin necesidad de navegador ni servidor. Tus datos
se guardan localmente en el directorio de datos de la app y **se conservan entre
sesiones y actualizaciones**.

```bash
npm run app:dev      # ejecuta la app de escritorio en modo desarrollo
npm run app:build    # compila el binario nativo + AppImage
```

El resultado queda en:

- Binario ejecutable: `src-tauri/target/release/eac-blessed`
- Instalable AppImage: `src-tauri/target/release/bundle/appimage/*.AppImage`

> Requisitos para compilar: [Rust](https://www.rust-lang.org/) y, en Linux,
> `webkit2gtk` (en Arch/CachyOS: `sudo pacman -S webkit2gtk-4.1`).

## 📥 Cómo importar tu Notion

1. En Notion: `⚙️ Settings` → `Export` (o en una página: `•••` → `Export`).
2. Elige **Markdown & CSV** e incluye subpáginas. Descarga el `.zip`.
3. En EAC Blessed, pulsa **⬇ Importar Notion** y selecciona ese `.zip`.

> Nota: las bases de datos de Notion se importan como subpáginas (cada fila es
> una página). Los `.csv` de las vistas de base de datos no se importan como
> tablas todavía.

## 🛠️ Stack

- React 19 + TypeScript + Vite
- BlockNote (editor de bloques)
- Dexie / IndexedDB (almacenamiento offline)
- JSZip (importación/exportación)
- Tauri 2 (app de escritorio nativa)

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
src-tauri/              # App de escritorio (Tauri / Rust)
```

## 📄 Licencia

[MIT](./LICENSE) © Enmanuel Canelon
