/**
 * Deterministic option order for AI tasks.
 * Uses task.id so the same task always gets the same order (consistent per attempt).
 * Correctness is checked by backend using key "a" | "b" | "c" | "d", not display position.
 */

export type TaskOptionKey = "a" | "b" | "c" | "d";

export interface TaskDisplayOption {
  key: TaskOptionKey;
  text: string;
}

/** Deterministic 0 or 1 from task id for consistent shuffle per task. */
function hashTaskIdToSwap(taskId: string): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) {
    h = (h * 31 + taskId.charCodeAt(i)) >>> 0;
  }
  return h % 2;
}

/** Deterministic permutation index (0-23) for 4 options based on task id. */
function hashTaskIdToPermutation(taskId: string): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) {
    h = (h * 31 + taskId.charCodeAt(i)) >>> 0;
  }
  return h % 24; // 4! = 24 permutations
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

const PERMUTATIONS_4: TaskOptionKey[][] = [
  ["a", "b", "c", "d"], ["a", "b", "d", "c"], ["a", "c", "b", "d"], ["a", "c", "d", "b"],
  ["a", "d", "b", "c"], ["a", "d", "c", "b"], ["b", "a", "c", "d"], ["b", "a", "d", "c"],
  ["b", "c", "a", "d"], ["b", "c", "d", "a"], ["b", "d", "a", "c"], ["b", "d", "c", "a"],
  ["c", "a", "b", "d"], ["c", "a", "d", "b"], ["c", "b", "a", "d"], ["c", "b", "d", "a"],
  ["c", "d", "a", "b"], ["c", "d", "b", "a"], ["d", "a", "b", "c"], ["d", "a", "c", "b"],
  ["d", "b", "a", "c"], ["d", "b", "c", "a"], ["d", "c", "a", "b"], ["d", "c", "b", "a"],
];

/**
 * Returns display order for 4 response options (A/B/C/D) based on task.id.
 * Deterministic shuffle so same task always gets same order.
 */
export function getTaskOptionsDisplayOrder4(task: {
  id: string;
  response_a: string;
  response_b: string;
  response_c: string;
  response_d: string;
}): TaskDisplayOption[] {
  const map: Record<TaskOptionKey, string> = {
    a: task.response_a,
    b: task.response_b,
    c: task.response_c,
    d: task.response_d,
  };
  const order = PERMUTATIONS_4[hashTaskIdToPermutation(task.id)];
  return order.map((key) => ({ key, text: map[key] }));
}
