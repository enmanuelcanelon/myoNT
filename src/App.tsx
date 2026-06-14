import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "./db";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import PageHeader from "./components/PageHeader";
import Logo from "./components/Logo";
import { exportAllToZip, importNotionZip, PAGE_LINK_PREFIX } from "./lib/notion";
import { checkForUpdates } from "./lib/updater";

type Theme = "light" | "dark";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "audio/mpeg": ".mp3",
};

/** Descarga un data-URL como archivo (convirtiéndolo a Blob para fiabilidad). */
function downloadDataUrl(dataUrl: string, filename: string) {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, comma);
  const mime = meta.split(";")[0] || "application/octet-stream";
  const isBase64 = /;base64/i.test(meta);
  const dataPart = dataUrl.slice(comma + 1);

  let blob: Blob;
  if (isBase64) {
    const bin = atob(dataPart);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = new Blob([decodeURIComponent(dataPart)], { type: mime });
  }

  let name = filename;
  const ext = EXT_BY_MIME[mime];
  if (ext && !name.toLowerCase().endsWith(ext)) name += ext;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("mn-theme") as Theme) || "light"
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const page = useLiveQuery(
    () => (selectedId ? db.pages.get(selectedId) : undefined),
    [selectedId]
  );

  const firstPageId = useLiveQuery(async () => {
    const p = await db.pages.orderBy("order").first();
    return p?.id ?? null;
  }, []);

  useEffect(() => {
    if (!selectedId && firstPageId) setSelectedId(firstPageId);
  }, [firstPageId, selectedId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mn-theme", theme);
  }, [theme]);

  // Comprueba actualizaciones OTA al arrancar (solo en la app de escritorio).
  useEffect(() => {
    void checkForUpdates(true);
  }, []);

  // Intercepta enlaces dentro del editor:
  // - Enlaces internos entre páginas -> navegan en la app (sin recargar).
  // - Enlaces a archivos incrustados (data:) -> se descargan.
  // Lo hacemos en fase de captura sobre mousedown Y click para adelantarnos al
  // editor (Tiptap abre los enlaces con window.open en mouseup).
  useEffect(() => {
    const onAnchorEvent = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.(
        "a"
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";

      if (href.startsWith(PAGE_LINK_PREFIX)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "click") setSelectedId(href.slice(PAGE_LINK_PREFIX.length));
        return;
      }
      if (href.startsWith("data:")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "click") {
          downloadDataUrl(href, anchor.textContent?.trim() || "archivo");
        }
      }
    };

    // Red de seguridad: el editor abre enlaces con window.open.
    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, ...rest: unknown[]) => {
      const u = typeof url === "string" ? url : url?.toString() ?? "";
      if (u.startsWith(PAGE_LINK_PREFIX)) {
        setSelectedId(u.slice(PAGE_LINK_PREFIX.length));
        return null;
      }
      if (u.startsWith("data:")) {
        downloadDataUrl(u, "archivo");
        return null;
      }
      return originalOpen(url as string, ...(rest as []));
    }) as typeof window.open;

    document.addEventListener("mousedown", onAnchorEvent, true);
    document.addEventListener("click", onAnchorEvent, true);
    return () => {
      document.removeEventListener("mousedown", onAnchorEvent, true);
      document.removeEventListener("click", onAnchorEvent, true);
      window.open = originalOpen;
    };
  }, []);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const existing = await db.pages.count();
    if (existing > 0) {
      const replace = confirm(
        `Ya tienes ${existing} páginas.\n\nAceptar = BORRAR todo y reemplazar con esta importación.\nCancelar = añadir sin borrar (puede duplicar).`
      );
      if (replace) {
        await db.pages.clear();
        setSelectedId(null);
      }
    }

    setBusy("Importando tu Notion…");
    try {
      const res = await importNotionZip(file);
      setBusy(null);
      alert(`Listo ✅ Importé ${res.pages} páginas.`);
    } catch (err) {
      setBusy(null);
      alert("No se pudo importar: " + (err as Error).message);
    }
  };

  const handleExport = async () => {
    setBusy("Exportando…");
    try {
      const blob = await exportAllToZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mi-notion-export.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app">
      <Sidebar
        selectedId={selectedId}
        onSelect={setSelectedId}
        onImport={() => fileRef.current?.click()}
        onExport={handleExport}
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === "light" ? "dark" : "light"))
        }
      />

      <main className="main">
        {page ? (
          <div className="page-scroll">
            <div className="page-container">
              <PageHeader page={page} />
              <Editor page={page} theme={theme} />
            </div>
          </div>
        ) : (
          <div className="welcome">
            <div className="welcome-card">
              <div className="welcome-logo">
                <Logo size={56} />
              </div>
              <h1>EAC Blessed</h1>
              <p>Tu espacio local, privado y offline.</p>
              <p className="muted">
                Crea una página nueva en la barra lateral o importa tu export de
                Notion (formato <em>Markdown &amp; CSV</em>).
              </p>
            </div>
          </div>
        )}
      </main>

      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />

      {busy && (
        <div className="overlay">
          <div className="spinner-box">
            <div className="spinner" />
            {busy}
          </div>
        </div>
      )}
    </div>
  );
}
