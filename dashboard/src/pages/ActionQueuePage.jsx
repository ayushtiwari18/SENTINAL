/**
 * ActionQueuePage — Full-page view for ArmorIQ blocked actions.
 * Wraps the ActionQueue component with page-level layout.
 */
import ActionQueue from '../components/ActionQueue';

export default function ActionQueuePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">ArmorIQ Action Queue</h1>
        <p className="text-gray-400 text-sm mt-1">
          Actions blocked by ArmorIQ policy that require human review before execution.
          Only <span className="text-red-400 font-semibold">high-risk and critical</span> actions
          appear here. Low-risk actions are executed automatically.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-yellow-700 bg-yellow-900/20 p-3 text-sm text-yellow-300">
        ⚠️ These actions were proposed by ArmorIQ but <strong>blocked by policy</strong> before
        execution. Review carefully before approving.
      </div>

      <ActionQueue />
    </div>
  );
}
