import { useEffect, useMemo, useRef } from "react";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import type { Page } from "../db";
import { updatePage } from "../db";

function EditorInner({ page, theme }: { page: Page; theme: "light" | "dark" }) {
  const saveTimer = useRef<number | null>(null);

  const initialContent = useMemo<PartialBlock[] | undefined>(() => {
    if (page.content && (page.content as unknown[]).length > 0) {
      return page.content as PartialBlock[];
    }
    return undefined;
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote({ initialContent });

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const handleChange = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      updatePage(page.id, { content: editor.document as unknown[] });
    }, 400);
  };

  return (
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      theme={theme}
      className="bn-editor"
    />
  );
}

export default function Editor({
  page,
  theme,
}: {
  page: Page;
  theme: "light" | "dark";
}) {
  // Recreamos el editor al cambiar de página (key) para cargar su contenido.
  return <EditorInner key={page.id} page={page} theme={theme} />;
}
