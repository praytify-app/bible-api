import { Navigate } from "@tanstack/react-router";
import { readerHomeTarget } from "@/features/reader/last-read";

/**
 * `/read` is a link people share and bookmark: it resumes the last chapter this
 * browser read, or opens John 3 (WEB). `replace` keeps the bounce out of history.
 */
export function ReaderHome() {
  const { version, book, chapter } = readerHomeTarget();
  return <Navigate to="/read/$version/$book/$chapter" params={{ version, book, chapter }} replace />;
}
