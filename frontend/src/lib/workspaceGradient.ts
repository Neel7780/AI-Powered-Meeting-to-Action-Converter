/** Deterministic gradient per workspace name, like Slack's workspace tiles. */
const tileGradients = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-indigo-600",
  "from-rose-500 to-fuchsia-600",
];
export function workspaceGradient(name = "") {
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return tileGradients[sum % tileGradients.length];
}
