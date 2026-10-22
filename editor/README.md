# Discussion editor

The site serves the bundled `assets/discussion-editor.js` locally. Build with Node:

```
cd editor
npm ci --ignore-scripts
npm run build
```

Dependencies and transitives are pinned by `package-lock.json`. Tiptap/ProseMirror provide the visual editor; see `THIRD_PARTY_LICENSES.txt` for bundled dependency notices.

New unformatted comments remain plain text. Formatted documents use `BG3RO-RICH-1:` followed by a ProseMirror JSON document in the existing body field. Rendering constructs DOM nodes from a strict allowlist, never user HTML. Only HTTP(S) links without credentials are accepted. Scripts, images, iframes, event attributes and arbitrary CSS are not rendered. Both the 4,000-character serialized body limit and a minimum of 10 visible text characters are enforced by the composer. Existing database constraints, guest permissions, rate limits and stored posts are unchanged.

The legacy `title` database column remains for backward compatibility, using a constant internally. No titles are requested or displayed in Discussions. Root pagination is 10 posts; replies load in batches of 100 with no total cap. This is not a removal of anti-abuse submission rate limits.
