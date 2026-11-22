export interface WorkSticker {
  id: string;
  label: string;
  desc: string;
  color: string;
  textClass: string;
  descClass: string;
}

export const STICKER_LIST: WorkSticker[] = [
  { id: 'sticker:lgtm', label: 'LGTM 👍', desc: 'Looks Good To Me', color: 'from-emerald-500 to-teal-600', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:on-it', label: 'On It! ⚡', desc: 'Working on it right now', color: 'from-amber-500 to-orange-500', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:review', label: 'Review Please 👀', desc: 'Ready for peer feedback', color: 'from-blue-500 to-indigo-600', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:ship-it', label: 'Ship It! 🚀', desc: 'Ready to deploy', color: 'from-purple-600 to-pink-600', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:celebrate', label: 'High Five! 🙌', desc: 'Awesome work team', color: 'from-rose-500 to-red-600', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:blocked', label: 'Blocked 🛑', desc: 'Need unblocking help', color: 'from-red-600 to-rose-700', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:coffee', label: 'Coffee Time ☕', desc: 'Taking a 5 min break', color: 'from-amber-700 to-stone-800', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:meeting-action', label: 'Action Item 📝', desc: 'Captured meeting task', color: 'from-indigo-600 to-blue-700', textClass: 'text-white', descClass: 'text-white/80' },
  { id: 'sticker:idea', label: 'Great Idea 💡', desc: 'Love this thought', color: 'from-yellow-400 to-amber-500', textClass: 'text-stone-900', descClass: 'text-stone-900/75' },
  { id: 'sticker:100', label: '100% Agreed 💯', desc: 'Totally aligned', color: 'from-pink-500 to-rose-600', textClass: 'text-white', descClass: 'text-white/80' },
];

export function getStickerLabel(stickerId: string): string | undefined {
  return STICKER_LIST.find((s) => s.id === stickerId)?.label;
}
