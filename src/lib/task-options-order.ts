/**
 * Deterministic option order for AI tasks.
 * Uses task.id so the same task always gets the same order (consistent per attempt).
 * Correctness is checked by backend using key "a" | "b", not display position.
 */

export type TaskOptionKey = "a" | "b";

export interface TaskDisplayOption {
  key: TaskOptionKey;
  text: string;
}

/**
 * Returns display order for response options (A/B) based on task.id.
 * Same task id => same order. Different tasks get ~50/50 first position over time.
 */
export function getTaskOptionsDisplayOrder(task: {
  id: string;
  response_a: string;
  response_b: string;
}): TaskDisplayOption[] {
  const a: TaskDisplayOption = { key: "a", text: task.response_a };
  const b: TaskDisplayOption = { key: "b", text: task.response_b };
  const swap = hashTaskIdToSwap(task.id);
  return swap ? [b, a] : [a, b];
}

/** Deterministic 0 or 1 from task id for consistent shuffle per task. */
function hashTaskIdToSwap(taskId: string): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) {
    h = (h * 31 + taskId.charCodeAt(i)) >>> 0;
  }
  return h % 2;
}
