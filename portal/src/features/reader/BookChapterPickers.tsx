import { useMemo, type ReactNode } from "react";
import { SearchSelect, Select } from "@/components/ds";
import type { BibleBook } from "@/lib/api";
import { isOldTestament, sortBooks } from "./chapter-nav";

const count = new Intl.NumberFormat();

export interface BookPickerProps {
  books: readonly BibleBook[] | undefined;
  bookCode: string;
  /** Shown on the trigger while books load, or when this translation lacks the book. */
  bookName: string;
  onSelect: (bookCode: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Type-to-filter book list ("jo" finds John, Jonah, Job, Joel, Joshua and the letters of John). */
export function BookPicker({ books, bookCode, bookName, onSelect, disabled, className }: BookPickerProps) {
  const options = useMemo(
    () =>
      sortBooks(books ?? []).map((book) => ({
        value: book.bookCode,
        label: book.name,
        description: `${isOldTestament(book) ? "Old Testament" : "New Testament"} · ${count.format(book.chapterCount)} ${
          book.chapterCount === 1 ? "chapter" : "chapters"
        }`,
        keywords: book.bookCode,
      })),
    [books],
  );

  return (
    <div className={className}>
      <SearchSelect
          aria-label="Book"
          options={options}
          value={bookCode}
          onValueChange={onSelect}
          placeholder={bookName}
          searchLabel="Find a book"
          searchPlaceholder="Book name"
          emptyMessage="No book by that name in this translation."
          maxResults={Math.max(options.length, 1)}
          disabled={disabled || options.length === 0}
        />
    </div>
  );
}

export interface ChapterPickerProps {
  book: BibleBook | undefined;
  chapter: number;
  onSelect: (chapter: number) => void;
  className?: string;
}

export function ChapterPicker({ book, chapter, onSelect, className }: ChapterPickerProps) {
  const options = useMemo(
    () => Array.from({ length: book?.chapterCount ?? 0 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    [book?.chapterCount],
  );
  const valid = book !== undefined && chapter >= 1 && chapter <= book.chapterCount;

  // Sized by a wrapper: the control fills its container (controlBase is w-full).
  return (
    <div className={className}>
      <Select
        aria-label="Chapter"
        options={options}
        value={valid ? String(chapter) : undefined}
        placeholder={String(chapter)}
        onValueChange={(value) => onSelect(Number(value))}
        disabled={!book}
      />
    </div>
  );
}

export interface BookChapterPickersRowProps {
  books: readonly BibleBook[] | undefined;
  currentBook: BibleBook | undefined;
  bookCode: string;
  bookName: string;
  chapter: number;
  booksFailed: boolean;
  onBook: (bookCode: string) => void;
  onChapter: (chapter: number) => void;
  /** The chapter arrows, kept on the same line as the pickers. */
  trailing?: ReactNode;
}

/** Full width on phones (its own line under the translation), one flexible column from sm up. */
export function BookChapterPickersRow({
  books,
  currentBook,
  bookCode,
  bookName,
  chapter,
  booksFailed,
  onBook,
  onChapter,
  trailing,
}: BookChapterPickersRowProps) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
      <BookPicker
        className="min-w-0 flex-1"
        books={books}
        bookCode={bookCode}
        bookName={bookName}
        onSelect={onBook}
        disabled={booksFailed}
      />
      <ChapterPicker className="w-20 shrink-0" book={currentBook} chapter={chapter} onSelect={onChapter} />
      {trailing}
    </div>
  );
}
