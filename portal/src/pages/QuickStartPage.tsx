import { Link } from "@tanstack/react-router";
import { CodeBlock } from "../components/CodeBlock";

export function QuickStartPage() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://api.praytify.bible";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Quick Start Guide</h1>
        <p className="mt-2 text-gray-600">
          Get up and running with the Praytify Bible API in under 5 minutes.
        </p>
      </div>

      {/* Step 1 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold">
            1
          </span>
          <h2 className="text-xl font-bold text-gray-900">Get your API key</h2>
        </div>
        <p className="text-gray-600 mb-4 ml-11">
          Sign in to the{" "}
          <Link to="/login" className="text-primary hover:text-primary-dark font-medium">
            developer portal
          </Link>{" "}
          and create a free API key from your dashboard.
        </p>
      </section>

      {/* Step 2 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold">
            2
          </span>
          <h2 className="text-xl font-bold text-gray-900">Make your first request</h2>
        </div>
        <div className="ml-11">
          <p className="text-gray-600 mb-4">
            Use your API key in the <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Authorization</code> header with the <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Bearer</code> prefix.
          </p>
          <CodeBlock
            tabs={[
              {
                label: "cURL",
                language: "bash",
                code: `curl -H "Authorization: Bearer pb_your_api_key" \\
  "${apiBase}/v1/versions"`,
              },
              {
                label: "JavaScript",
                language: "javascript",
                code: `const API_KEY = "pb_your_api_key";
const BASE = "${apiBase}";

const res = await fetch(\`\${BASE}/v1/versions\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});
const { data } = await res.json();
console.log(data); // Array of available Bible versions`,
              },
              {
                label: "Python",
                language: "python",
                code: `import requests

API_KEY = "pb_your_api_key"
BASE = "${apiBase}"
headers = {"Authorization": f"Bearer {API_KEY}"}

response = requests.get(f"{BASE}/v1/versions", headers=headers)
versions = response.json()["data"]
print(f"Found {len(versions)} versions")`,
              },
            ]}
          />
        </div>
      </section>

      {/* Step 3 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold">
            3
          </span>
          <h2 className="text-xl font-bold text-gray-900">Explore the API</h2>
        </div>
        <div className="ml-11">
          <p className="text-gray-600 mb-4">
            The API provides these core endpoints. All require a valid API key via <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code>.
          </p>

          <div className="space-y-3">
            <EndpointCard
              method="GET"
              path="/v1/languages"
              description="List all languages"
            />
            <EndpointCard
              method="GET"
              path="/v1/versions"
              description="List all Bible versions (filter: ?language=eng)"
            />
            <EndpointCard
              method="GET"
              path="/v1/versions/:id/books"
              description="List books in a version (use UUID or abbreviation like KJV)"
            />
            <EndpointCard
              method="GET"
              path="/v1/books/:id/chapters"
              description="List chapters in a book"
            />
            <EndpointCard
              method="GET"
              path="/v1/verses?ref=John+3:16&version=KJV"
              description="Look up a verse by reference"
            />
            <EndpointCard
              method="GET"
              path="/v1/verses?ref=John+3:16&version=KJV,WEB"
              description="Parallel verse lookup (multiple versions)"
            />
            <EndpointCard
              method="GET"
              path="/v1/search?q=love&version=KJV&limit=20"
              description="Full-text search"
            />
            <EndpointCard
              method="GET"
              path="/v1/daily"
              description="Verse of the day"
            />
          </div>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold">
            4
          </span>
          <h2 className="text-xl font-bold text-gray-900">Read a verse</h2>
        </div>
        <div className="ml-11">
          <p className="text-gray-600 mb-4">
            Fetch John 3:16 from the King James Version:
          </p>
          <CodeBlock
            tabs={[
              {
                label: "cURL",
                language: "bash",
                code: `curl -H "Authorization: Bearer pb_your_api_key" \\
  "${apiBase}/v1/verses?ref=John+3:16&version=KJV"`,
              },
              {
                label: "JavaScript",
                language: "javascript",
                code: `const res = await fetch(
  \`\${BASE}/v1/verses?ref=John+3:16&version=KJV\`,
  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
);
const { data } = await res.json();
console.log(data.text);
// "For God so loved the world, that he gave his only
//  begotten Son, that whosoever believeth in him should
//  not perish, but have everlasting life."`,
              },
              {
                label: "Python",
                language: "python",
                code: `res = requests.get(
    f"{BASE}/v1/verses",
    params={"ref": "John 3:16", "version": "KJV"},
    headers=headers
)
verse = res.json()["data"]
print(verse["text"])
# "For God so loved the world, that he gave his only
#  begotten Son, that whosoever believeth in him should
#  not perish, but have everlasting life."`,
              },
            ]}
          />
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Tip:</strong> Use <code className="bg-amber-100 px-1 rounded">version=KJV,WEB</code> to fetch the same verse from multiple translations in one request.
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="bg-primary-50 rounded-xl border border-primary/10 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Next steps</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>
              Browse{" "}
              <Link to="/docs/translations" className="text-primary font-medium">
                available translations
              </Link>{" "}
              to find what you need
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>
              Explore the full{" "}
              <Link to="/docs" className="text-primary font-medium">
                API reference
              </Link>{" "}
              with interactive examples (Scalar docs)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>
              Check your{" "}
              <Link to="/dashboard/usage" className="text-primary font-medium">
                usage dashboard
              </Link>{" "}
              to monitor API calls
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold text-green-700 bg-green-100 uppercase mt-0.5">
        {method}
      </span>
      <div className="min-w-0">
        <code className="text-sm text-gray-700 font-mono break-all">{path}</code>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
