import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { translations, type Translation } from "../lib/api";

export function TranslationsPage() {
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  const { data: translationList, isLoading } = useQuery({
    queryKey: ["translations"],
    queryFn: () => translations.list(),
  });

  const languages = useMemo(() => {
    if (!translationList) return [];
    const langs = [...new Set(translationList.map((t) => t.language))].sort();
    return langs;
  }, [translationList]);

  const filtered = useMemo(() => {
    if (!translationList) return [];
    return translationList.filter((t) => {
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.abbreviation.toLowerCase().includes(search.toLowerCase()) ||
        t.language.toLowerCase().includes(search.toLowerCase());
      const matchesLanguage =
        !languageFilter || t.language === languageFilter;
      return matchesSearch && matchesLanguage;
    });
  }, [translationList, search, languageFilter]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Bible Translations
        </h1>
        <p className="mt-2 text-gray-600">
          Browse all available translations. Use the search and filter to find
          what you need.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, abbreviation, or language..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        >
          <option value="">All Languages</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {/* Count */}
      <div className="mb-4 text-sm text-gray-500">
        {isLoading
          ? "Loading translations..."
          : `${filtered.length} translation${filtered.length !== 1 ? "s" : ""} found`}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Abbreviation
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Direction
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-sm font-mono text-primary font-semibold">
                        {t.abbreviation}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.language}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 uppercase">
                      {t.textDirection || "ltr"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">
            No translations match your search criteria.
          </p>
        </div>
      )}
    </div>
  );
}
