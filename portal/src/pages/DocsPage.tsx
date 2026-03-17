const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3200";

export function DocsPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={`${API_URL}/docs`}
        title="API Documentation"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}
