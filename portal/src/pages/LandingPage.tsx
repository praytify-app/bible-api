import { Link } from "@tanstack/react-router";
import { CodeBlock } from "../components/CodeBlock";

const codeExamples = [
  {
    label: "cURL",
    language: "bash",
    code: `# Look up a verse
curl -H "Authorization: Bearer pb_your_api_key" \\
  "https://api.praytify.bible/v1/verses?ref=John+3:16&version=KJV"

# Search across a version
curl -H "Authorization: Bearer pb_your_api_key" \\
  "https://api.praytify.bible/v1/search?q=love&version=KJV&limit=5"`,
  },
  {
    label: "JavaScript",
    language: "javascript",
    code: `const API_KEY = "pb_your_api_key";
const BASE = "https://api.praytify.bible";

// Look up a verse
const res = await fetch(
  \`\${BASE}/v1/verses?ref=John+3:16&version=KJV\`,
  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
);
const { data } = await res.json();
console.log(data.text);
// "For God so loved the world..."`,
  },
  {
    label: "Python",
    language: "python",
    code: `import requests

API_KEY = "pb_your_api_key"
BASE = "https://api.praytify.bible"
headers = {"Authorization": f"Bearer {API_KEY}"}

# Look up a verse
res = requests.get(
    f"{BASE}/v1/verses",
    params={"ref": "John 3:16", "version": "KJV"},
    headers=headers
)
print(res.json()["data"]["text"])
# "For God so loved the world..."`,
  },
];

const features = [
  {
    title: "600+ Translations",
    description: "Access Bible texts across 600+ translations in over 100 languages, from KJV to modern versions.",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    title: "REST API",
    description: "Clean, well-documented RESTful endpoints. Hierarchical navigation from books to chapters to verses.",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  },
  {
    title: "Free Forever",
    description: "No cost for individuals. Generous rate limits. No hidden tiers or surprise charges.",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  {
    title: "Developer Dashboard",
    description: "Manage API keys, monitor usage, and track your application's performance in real time.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "OpenAPI Spec",
    description: "Interactive API documentation with Scalar. Try endpoints directly from your browser.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    title: "Open Licensing",
    description: "Every translation is redistributable, with license and attribution metadata included in API responses.",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

const stats = [
  { value: "600+", label: "Translations" },
  { value: "100+", label: "Languages" },
  { value: "Free", label: "For Everyone" },
  { value: "1K", label: "Requests/Day" },
];

export function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary text-sm font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Open Bible API
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight font-serif">
            The Bible API<br />
            <span className="text-primary">for Developers</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Access 600+ Bible translations in 100+ languages through a clean, modern REST API.
            Free API keys, generous rate limits, and interactive documentation.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center px-8 py-3.5 text-base font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-lg shadow-primary/25 no-underline transition-all hover:shadow-xl hover:shadow-primary/30"
            >
              Get your free API key
              <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/read"
              className="inline-flex items-center px-8 py-3.5 text-base font-bold text-gray-700 bg-white border border-gray-300 hover:border-gray-400 rounded-xl no-underline transition-colors"
            >
              Read the Bible online
            </Link>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-8">
            Start building in seconds
          </h2>
          <CodeBlock tabs={codeExamples} />
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-extrabold text-primary">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything you need to build Bible-powered apps
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              A complete platform for developers building faith-based applications.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Join the community
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
            Praytify Bible is open and free for everyone. Build apps that bring
            Scripture closer to people around the world.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center px-8 py-3.5 text-base font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-lg shadow-primary/25 no-underline transition-all"
            >
              Get started for free
            </Link>
            <a
              href="https://github.com/praytify"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-gray-700 bg-white border border-gray-300 hover:border-gray-400 rounded-xl no-underline transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
