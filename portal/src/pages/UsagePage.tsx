import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usage } from "../lib/api";

export function UsagePage() {
  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ["usage-daily"],
    queryFn: () => usage.daily(30),
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => usage.summary(),
  });

  // Generate placeholder data if API returns empty
  const chartData =
    dailyData?.daily && dailyData.daily.length > 0
      ? dailyData.daily
      : Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          return {
            date: date.toISOString().split("T")[0],
            requests: 0,
            errors: 0,
            avgResponseTimeMs: 0,
          };
        });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Usage</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor your API usage over the last 30 days.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Total Requests</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loadingSummary ? "--" : (summary?.totalRequests?.toLocaleString() ?? "0")}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Total Errors</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loadingSummary ? "--" : (summary?.totalErrors?.toLocaleString() ?? "0")}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Avg Response</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loadingSummary ? "--" : `${summary?.avgResponseTimeMs ?? 0}ms`}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-500">Active Keys</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loadingSummary ? "--" : (summary?.activeKeys ?? "0")}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Daily Requests</h2>
        {loadingDaily ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    fontSize: "13px",
                  }}
                  labelFormatter={(label: string) =>
                    new Date(label).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "#4F46E5" }}
                />
                <Line
                  type="monotone"
                  dataKey="errors"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                  activeDot={{ r: 4, fill: "#ef4444" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
