# 📋 Project Encoding Rules — BCAPrime

## 1. Always Use UTF-8

Every file that is written or updated must be saved in **UTF-8 encoding**.  
No file should be saved in ANSI, Windows-1252, or any other encoding.

- HTML files must include `<meta charset="utf-8">`.
- CSS and JS files must also be saved in UTF-8.
- When reading or writing files in scripts, always specify `encoding='utf-8'`.

## 2. Safe Use of Special Characters

For special characters (smart quotes, em-dashes, non-breaking spaces, arrows, emoji, etc.):

### ✅ Correct Approach

| Character | Safe UTF-8 | HTML Entity (if needed) |
|-----------|------------|-------------------------|
| Smart open quote “ | `\u201C` | `&ldquo;` |
| Smart close quote ” | `\u201D` | `&rdquo;` |
| Smart open single ‘ | `\u2018` | `&lsquo;` |
| Smart close single ’ | `\u2019` | `&rsquo;` |
| Em-dash — | `\u2014` | `&mdash;` |
| En-dash – | `\u2013` | `&ndash;` |
| Non-breaking space | `\u00A0` | `&nbsp;` |
| Ellipsis … | `\u2026` | `&hellip;` |
| Check mark ✓ | `\u2713` | `&#10003;` |
| Bullet • | `\u2022` | `&#8226;` |
| Arrow → | `\u2192` | `&rarr;` |

### ❌ Avoid This

- Raw Windows-1252 bytes that decode to garbled text like `â€“`, `âœ”`, `ðŸ™` in UTF-8.
- Always verify that any copied or pasted character is valid UTF-8 before using it.

## 3. Mojibake Prevention

Mojibake (e.g., `âě`, `â€“`, `âœ”`, `ðŸ™`) must never appear on the frontend.

- Before pushing any text or code, verify the file is saved in UTF-8.
- If garbled text is found in any file, fix it immediately.
- Emoji and special characters should be written as actual UTF-8 characters, not as double-encoded bytes.

## 4. File Save Rules

Whenever you write or update code:

1. Save files in **UTF-8 without BOM** (BOM is optional but not recommended).
2. HTML files must include `<meta charset="utf-8">`.
3. Python scripts that read/write files must use `open(path, encoding='utf-8')`.
4. Before committing, check `git diff` for any garbled characters.

## 5. Pre-Commit Checklist

- [ ] Are all files saved in UTF-8 encoding?
- [ ] Is `<meta charset="utf-8">` present in HTML files?
- [ ] Are there any smart quotes / em-dashes / special characters in raw Windows-1252?
- [ ] Are there any remaining mojibake patterns (â€, âœ, ðŸ, Ã, Â)?
- [ ] Do emoji and symbols render correctly?

---

**These rules apply to all developers and AI agents working on this project.**
