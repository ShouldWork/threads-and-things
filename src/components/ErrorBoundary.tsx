import { Component, type ReactNode } from "react";

// Catches a crash in one page so the rest of the app (header, tabs, + button) keeps working.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("Page crashed", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="empty" role="alert" style={{ marginTop: 24 }}>
      <b>This page hit a snag</b>
      Something in your records could not be shown here. Your data is safe. Try another tab, or reload.
      <div className="actions" style={{ justifyContent: "center", marginTop: 12 }}><button type="button" className="btn primary" onClick={() => location.reload()}>Reload</button></div>
    </div>;
  }
}
