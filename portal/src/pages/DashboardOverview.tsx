import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { usage, keys } from "../lib/api";
import { useSession } from "../lib/auth";

export function DashboardOverview() {
  const { data: session } = useSession();
  const { data: summary } = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => usage.summary(),
  });
  const { data: keyList } = useQuery({
    queryKey: ["keys"],
    queryFn: () => keys.list(),
  });

  const firstName = session?.user?.name?.split(" ")[0] || "Developer";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here is an overview of your API usage.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Total Requests</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">
            {summary?.totalRequests?.toLocaleString() ?? "0"}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Requests Today</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">
            {summary?.totalRequests ? "0" : "0"}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Active Keys</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">
            {keyList?.length ?? summary?.activeKeys ?? "0"}
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Start</h2>
        {keyList && keyList.length > 0 ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Use your API key to make requests:
            </p>
            <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300">
                <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${import.meta.env.VITE_API_URL || "https://api.praytify.bible"}/v1/verses?ref=John+3:16&version=KJV"`}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-4">
              Create your first API key to get started.
            </p>
            <Link
              to="/dashboard/keys"
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg no-underline transition-colors"
            >
              Create API Key
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
