import JSZip from "jszip";
import { BlockNoteEditor } from "@blocknote/core";
import db, { uid, type Page } from "../db";

/**
 * Importa un export de Notion (formato "Markdown & CSV", el .zip que descargas
 * desde Notion). Reconstruye el árbol de páginas anidadas y convierte el
 * Markdown a bloques del editor. Las imágenes incluidas en el zip se incrustan
 * como data-URLs para que funcionen 100% offline.
 */

const HASH_RE = /\s+[0-9a-f]{32}$/i;

function cleanName(name: string): string {
  return name.replace(HASH_RE, "").trim();
}

/** Quita la extensión .md de una ruta. */
function stripMd(path: string): string {
  return path.replace(/\.md$/i, "");
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

export interface ImportResult {
  pages: number;
}

export async function importNotionZip(file: File | Blob): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  // Recolecta todos los .md y el resto de ficheros (imágenes, etc.)
  const mdFiles: { path: string; entry: JSZip.JSZipObject }[] = [];
  const assets: Record<string, JSZip.JSZipObject> = {};

  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (/\.md$/i.test(path)) {
      mdFiles.push({ path, entry });
    } else {
      assets[path] = entry;
    }
  });

  if (mdFiles.length === 0) {
    throw new Error(
      "No encontré archivos .md en el zip. Exporta desde Notion como 'Markdown & CSV'."
    );
  }

  // Mapa: ruta-sin-.md -> id de página (para enlazar padres/hijos)
  const keyToId = new Map<string, string>();
  for (const { path } of mdFiles) {
    keyToId.set(stripMd(path), uid());
  }

  const editor = BlockNoteEditor.create();
  const now = Date.now();
  const pagesToAdd: Page[] = [];
  const orderByParent = new Map<string | null, number>();

  for (const { path, entry } of mdFiles) {
    const key = stripMd(path);
    const id = keyToId.get(key)!;

    // El padre es el .md cuya clave coincide con la carpeta contenedora.
    const slash = key.lastIndexOf("/");
    const dir = slash === -1 ? "" : key.slice(0, slash);
    const parentId = dir && keyToId.has(dir) ? keyToId.get(dir)! : null;

    let markdown = await entry.async("string");

    // Título: primer encabezado "# ..." o el nombre del archivo limpio.
    const fileBase = key.slice(slash + 1);
    let title = cleanName(fileBase);
    const titleMatch = markdown.match(/^\s*#\s+(.+?)\s*$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Elimina ese primer H1 para no duplicarlo en el cuerpo.
      markdown = markdown.replace(/^\s*#\s+.+?\s*$/m, "").trimStart();
    }

    markdown = await inlineImages(markdown, path, assets);

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

/** Reemplaza ![alt](ruta-local) por data-URLs leídas del propio zip. */
async function inlineImages(
  markdown: string,
  mdPath: string,
  assets: Record<string, JSZip.JSZipObject>
): Promise<string> {
  const baseDir = mdPath.includes("/")
    ? mdPath.slice(0, mdPath.lastIndexOf("/") + 1)
    : "";

  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...markdown.matchAll(imgRe)];

  for (const m of matches) {
    const rawUrl = m[2];
    if (/^https?:|^data:/i.test(rawUrl)) continue;

    let rel = decodeURIComponent(rawUrl.split("#")[0].split("?")[0]);
    const candidates = [baseDir + rel, rel];
    const found = candidates.find((c) => assets[c]);
    if (!found) continue;

    const ext = found.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME[ext] ?? "application/octet-stream";
    const b64 = await assets[found].async("base64");
    const dataUrl = `data:${mime};base64,${b64}`;
    markdown = markdown.replace(rawUrl, dataUrl);
  }

  return markdown;
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
