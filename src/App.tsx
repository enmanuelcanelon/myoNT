import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "./db";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import PageHeader from "./components/PageHeader";
import { exportAllToZip, importNotionZip } from "./lib/notion";

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const page = useLiveQuery(
    () => (selectedId ? db.pages.get(selectedId) : undefined),
    [selectedId]
  );

  // Selecciona la primera página al cargar si no hay ninguna seleccionada.
  const firstPageId = useLiveQuery(async () => {
    const p = await db.pages.orderBy("order").first();
    return p?.id ?? null;
  }, []);

  useEffect(() => {
    if (!selectedId && firstPageId) setSelectedId(firstPageId);
  }, [firstPageId, selectedId]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
      />

      <main className="main">
        {page ? (
          <div className="page-scroll">
            <div className="page-container">
              <PageHeader page={page} />
              <Editor page={page} />
            </div>
          </div>
        ) : (
          <div className="welcome">
            <div className="welcome-card">
              <h1>◆ Mi Notion</h1>
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
