const AVATARS = ['🐱','🐶','🦊','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐙','🦄'];
const PREFIXES = ['ニャン','ミャオ','ネコ','タマ','クロ','シロ','トラ','サビ'];
const NAME_KEY = 'nyan-player-name';

export function getAvatar(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATARS[Math.abs(h) % AVATARS.length];
}

export function genPlayerId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function genRandomName(): string {
  const p = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  return p + String(Math.floor(Math.random() * 900) + 100);
}

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) || genRandomName();
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim() || genRandomName());
}

export function genRoomCode(): string {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}
