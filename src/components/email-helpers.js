// goHR — mailbox pure helpers (no DOM) shared by email.js and the tests.
export const unreadCount = (list) => (list || []).filter(m => !m.read).length;

export function parseOutbox(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
