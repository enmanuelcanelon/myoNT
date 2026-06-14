/**
 * Comprobación de actualizaciones OTA (solo en la app de escritorio Tauri).
 * Descarga e instala automáticamente la última versión publicada en GitHub
 * Releases, previa confirmación del usuario.
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function checkForUpdates(silent = false): Promise<void> {
  if (!isTauri()) return;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();

    if (!update) {
      if (!silent) alert("Ya tienes la última versión. ✅");
      return;
    }

    const ok = confirm(
      `Hay una nueva versión disponible (${update.version}).\n\n` +
        (update.body ? `Novedades:\n${update.body}\n\n` : "") +
        "¿Descargar e instalar ahora?"
    );
    if (!ok) return;

    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (total) {
            const pct = Math.round((downloaded / total) * 100);
            console.log(`Descargando actualización: ${pct}%`);
          }
          break;
        case "Finished":
          console.log("Descarga completada, instalando…");
          break;
      }
    });

    const relaunchNow = confirm(
      "Actualización instalada. ¿Reiniciar la app ahora para aplicarla?"
    );
    if (relaunchNow) {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    }
  } catch (err) {
    console.error("Error comprobando actualizaciones:", err);
    if (!silent) {
      alert("No se pudo comprobar actualizaciones: " + (err as Error).message);
    }
  }
}
