import { CircuitBoard } from "@/components/CircuitBoard";

/**
 * Main entry point for the application.
 * Renders the CircuitBoard component within a dark-themed layout.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <CircuitBoard />
    </main>
  );
}
