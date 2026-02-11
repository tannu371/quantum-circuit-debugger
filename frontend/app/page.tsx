import { CircuitBoard } from "@/components/CircuitBoard";

/**
 * Main entry point for the application.
 * Renders the CircuitBoard component within a themed layout.
 */
export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <CircuitBoard />
    </main>
  );
}
