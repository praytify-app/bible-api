import { useState } from "react";

interface CodeBlockProps {
  tabs: { label: string; language: string; code: string }[];
}

export function CodeBlock({ tabs }: CodeBlockProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-950 shadow-lg">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === i
                ? "text-primary border-b-2 border-primary bg-gray-950"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Code */}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="text-gray-300">{tabs[activeTab].code}</code>
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(tabs[activeTab].code)}
          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title="Copy to clipboard"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        </button>
      </div>
    </div>
  );
}
