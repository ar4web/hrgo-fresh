// goHR — sidebar Settings tree deep links (settings.html#<hash> → panel key).
// Pure map (no DOM) so the Node test suite can pin it. settings.js consumes
// it to activate the matching rail panel on load and hash change.
export const HASH_PANEL = {
  'brand-kits': 'app',
  'documents': 'modules',
  'assets': 'files',
  'app-settings': 'apps',
  'theme-center': 'theme',
  'troubleshoot': 'diag',
  'about': 'company'
};
