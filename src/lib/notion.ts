import JSZip from "jszip";
import { BlockNoteEditor } from "@blocknote/core";
import db, { uid, type Page } from "../db";

/**
 * Importa un export de Notion (formato "Markdown & CSV", el .zip que descargas
 * desde Notion). Reconstruye el árbol de páginas anidadas, convierte el Markdown
 * a bloques del editor, incrusta imágenes y archivos (PDF, etc.) como data-URLs
 * para que funcionen 100% offline, y reescribe los enlaces internos entre
 * páginas para que naveguen dentro de la app.
 */

/** Prefijo de href para enlaces internos entre páginas (interceptado al hacer click). */
export const PAGE_LINK_PREFIX = "https://minotion.local/p/";

const HASH_RE = /\s+[0-9a-f]{32}$/i;

/** Quita la extensión .md de una ruta. */
function stripMd(path: string): string {
  return path.replace(/\.md$/i, "");
}

/**
 * En los exports de Notion, los .md llevan un hash en el nombre pero las
 * CARPETAS no. Esta función normaliza una ruta quitando el hash del ÚLTIMO
 * segmento, de modo que coincida con el nombre de carpeta de sus hijos.
 */
function cleanKey(keyWithHash: string): string {
  const slash = keyWithHash.lastIndexOf("/");
  const dir = slash === -1 ? "" : keyWithHash.slice(0, slash);
  const base = slash === -1 ? keyWithHash : keyWithHash.slice(slash + 1);
  const cleanBase = base.replace(HASH_RE, "").trim();
  return dir ? `${dir}/${cleanBase}` : cleanBase;
}

/** Resuelve una ruta relativa (con ./ y ../) contra un directorio base. */
function resolvePath(baseDir: string, rel: string): string {
  const stack = baseDir ? baseDir.split("/") : [];
  for (const part of rel.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

async function assetToDataUrl(entry: JSZip.JSZipObject, path: string): Promise<string> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME[ext] ?? "application/octet-stream";
  const b64 = await entry.async("base64");
  return `data:${mime};base64,${b64}`;
}

async function replaceAsync(
  str: string,
  re: RegExp,
  fn: (match: RegExpMatchArray) => Promise<string>
): Promise<string> {
  const matches = [...str.matchAll(re)];
  let out = "";
  let last = 0;
  for (const m of matches) {
    out += str.slice(last, m.index);
    out += await fn(m);
    last = m.index! + m[0].length;
  }
  out += str.slice(last);
  return out;
}

export interface ImportResult {
  pages: number;
}

export async function importNotionZip(file: File | Blob): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  const mdFiles: { path: string; entry: JSZip.JSZipObject }[] = [];
  const assets: Record<string, JSZip.JSZipObject> = {};

  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (/\.md$/i.test(path)) mdFiles.push({ path, entry });
    else assets[path] = entry;
  });

  if (mdFiles.length === 0) {
    throw new Error(
      "No encontré archivos .md en el zip. Exporta desde Notion como 'Markdown & CSV'."
    );
  }

  // Mapa: clave normalizada (sin hash) -> id de página, para enlazar
  // padres/hijos y reescribir los enlaces internos.
  const keyToId = new Map<string, string>();
  for (const { path } of mdFiles) {
    keyToId.set(cleanKey(stripMd(path)), uid());
  }

  const editor = BlockNoteEditor.create();
  const now = Date.now();
  const pagesToAdd: Page[] = [];
  const orderByParent = new Map<string | null, number>();

  for (const { path, entry } of mdFiles) {
    const fullKey = stripMd(path);
    const myKey = cleanKey(fullKey);
    const id = keyToId.get(myKey)!;

    // El padre es la carpeta contenedora (las carpetas no llevan hash, así que
    // su nombre coincide con una clave normalizada).
    const slash = fullKey.lastIndexOf("/");
    const dir = slash === -1 ? "" : fullKey.slice(0, slash);
    const parentId = dir && keyToId.has(dir) ? keyToId.get(dir)! : null;

    let markdown = await entry.async("string");

    const fileBase = myKey.slice(myKey.lastIndexOf("/") + 1);
    let title = fileBase;
    const titleMatch = markdown.match(/^\s*#\s+(.+?)\s*$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      markdown = markdown.replace(/^\s*#\s+.+?\s*$/m, "").trimStart();
    }

    markdown = await rewriteLinks(markdown, path, assets, keyToId);

    const blocks = await editor.tryParseMarkdownToBlocks(markdown);

    const order = orderByParent.get(parentId) ?? 0;
    orderByParent.set(parentId, order + 1);

    pagesToAdd.push({
      id,
      title: title || "Sin título",
      icon: "📄",
      parentId,
      content: blocks as unknown[],
      order,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.pages.bulkAdd(pagesToAdd);
  return { pages: pagesToAdd.length };
}

/**
 * Reescribe imágenes y enlaces del Markdown:
 * - Imágenes/archivos locales -> data-URLs (offline).
 * - Enlaces a otras páginas (.md) -> enlace interno que navega en la app.
 */
async function rewriteLinks(
  markdown: string,
  mdPath: string,
  assets: Record<string, JSZip.JSZipObject>,
  keyToId: Map<string, string>
): Promise<string> {
  const baseDir = mdPath.includes("/")
    ? mdPath.slice(0, mdPath.lastIndexOf("/"))
    : "";

  const re = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;

  return replaceAsync(markdown, re, async (m) => {
    const [full, bang, text, url] = m;
    if (/^(https?:|data:|mailto:|tel:|#)/i.test(url)) return full;

    const clean = decodeURIComponent(url.split("#")[0].split("?")[0]);
    const resolved = resolvePath(baseDir, clean);

    // Enlace a otra página de Notion.
    if (/\.md$/i.test(clean)) {
      const targetId = keyToId.get(cleanKey(stripMd(resolved)));
      if (targetId) return `${bang}[${text}](${PAGE_LINK_PREFIX}${targetId})`;
      return full;
    }

    // Imagen o archivo local: incrustar como data-URL.
    const asset = assets[resolved] ?? assets[clean];
    if (asset) {
      const dataUrl = await assetToDataUrl(asset, resolved);
      return `${bang}[${text}](${dataUrl})`;
    }

    return full;
  });
}

/** Convierte el contenido de una página a Markdown. */
export async function pageToMarkdown(page: Page): Promise<string> {
  const editor = BlockNoteEditor.create();
  const heading = `# ${page.icon} ${page.title}\n\n`;
  if (!page.content || (page.content as unknown[]).length === 0) return heading;
  const md = await editor.blocksToMarkdownLossy(page.content as never);
  return heading + md;
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120) || "sin-titulo";
}

/** Exporta TODAS las páginas como un .zip de Markdown con la jerarquía. */
export async function exportAllToZip(): Promise<Blob> {
  const pages = await db.pages.toArray();
  const byId = new Map(pages.map((p) => [p.id, p]));
  const zip = new JSZip();

  const pathFor = (page: Page): string => {
    const parts: string[] = [safeFileName(page.title)];
    let current = page;
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      if (!parent) break;
      parts.unshift(safeFileName(parent.title));
      current = parent;
    }
    return parts.join("/");
  };

  for (const page of pages) {
    const md = await pageToMarkdown(page);
    zip.file(`${pathFor(page)}.md`, md);
  }

  return zip.generateAsync({ type: "blob" });
}
