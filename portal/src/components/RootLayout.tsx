import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useSession, signOut } from "../lib/auth";

export function RootLayout() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 no-underline">
              <span className="text-primary">praytify</span>
              <span className="text-gray-400 font-normal">.bible</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/docs"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 no-underline"
              >
                Docs
              </Link>
              <Link
                to="/docs/quickstart"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 no-underline"
              >
                Quick Start
              </Link>
              <Link
                to="/docs/translations"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 no-underline"
              >
                Translations
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 no-underline"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg no-underline transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Powered by{" "}
              <a
                href="https://praytify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:text-primary-dark no-underline"
              >
                Praytify
              </a>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link to="/docs" className="hover:text-gray-700 no-underline text-gray-500">
                API Docs
              </Link>
              <Link to="/docs/quickstart" className="hover:text-gray-700 no-underline text-gray-500">
                Quick Start
              </Link>
              <a
                href="https://github.com/praytify"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 no-underline text-gray-500"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
