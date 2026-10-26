import React from "react";

/**
 * ChunkBoundary — keeps a failed lazy-route download from blanking the app.
 *
 * With route-level code splitting, a tab left open across a deploy can ask for
 * a chunk whose hashed filename no longer exists (and flaky mobile networks
 * can simply drop the request). Without this, the rejected import unmounts the
 * whole tree and leaves a white screen; here the user gets a reload button.
 */
class ChunkBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Kept in the console for diagnosing a bad deploy.
    console.error("Failed to load a page chunk", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-base)] px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center shadow-[var(--elev-2)]">
          <h1 className="font-display text-lg font-bold tracking-tight text-on">
            This page could not load
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-on-dim">
            TrackED was updated while this tab was open. Reload to get the latest version.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--brand-solid)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ChunkBoundary;
