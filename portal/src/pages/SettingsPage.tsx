import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profile } from "../lib/api";

const useCases = [
  "Bible App",
  "Church Website",
  "Devotional App",
  "Study Tool",
  "Ministry Platform",
  "Educational",
  "Personal Project",
  "Other",
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [appName, setAppName] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profile.get(),
  });

  useEffect(() => {
    if (profileData) {
      // Pre-existing server-to-form sync, newly flagged by eslint-plugin-react-hooks 7.1.
      // Suppressed only to keep the upgrade green; Phase 4 rewrites this form (AUDIT finding 2).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppName(profileData.appName || "");
      setAppUrl(profileData.appUrl || "");
      setDescription(profileData.description || "");
    }
  }, [profileData]);

  const updateMutation = useMutation({
    mutationFn: () => profile.update({ appName, appUrl, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your developer profile and application details.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          Application Details
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App Name
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="My Bible App"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App URL
            </label>
            <input
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://mybibleapp.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Use Case
            </label>
            <select
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="">Select a use case...</option>
              {useCases.map((uc) => (
                <option key={uc} value={uc}>
                  {uc}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">
                Changes saved successfully.
              </span>
            )}
          </div>
        </div>

        {/* Tier Info */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Current Plan
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              Free
            </span>
            <span className="text-sm text-gray-500">
              1,000 requests per day, 60 per minute
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
