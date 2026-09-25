import DOMPurify from 'dompurify';

/**
 * HTML Sanitization Utilities
 * 
 * IMPORTANT: This is a basic sanitizer. For production use with user-generated HTML,
 * install DOMPurify: npm install dompurify
 * 
 * Then replace these functions with:
 * import DOMPurify from 'dompurify';
 * export const sanitizeHTML = (html) => DOMPurify.sanitize(html, {...config});
 */

/**
 * Basic HTML sanitizer - removes script tags and dangerous attributes
 * WARNING: This is NOT a complete XSS solution. Use DOMPurify in production.
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string' || html.length === 0) return '';
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function formatRichText(text) {
  if (typeof text !== 'string' || text.length === 0) return '';

  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/\^(.*?)\^/g, '<sup>$1</sup>')
    .replace(/~(.*?)~/g, '<sub>$1</sub>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" />');

  return sanitizeHTML(html);
}

/**
 * Sanitize plain text - removes all HTML
 */
export function sanitizeText(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create safe render object for dangerouslySetInnerHTML
 * This wraps sanitizeHTML for convenient use in React components
 */
export function renderSafeHTML(html) {
  return { __html: sanitizeHTML(html) };
}

/**
 * Sanitize user input before sending to API
 * Trims whitespace and removes control characters
 */
export function sanitizeInput(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/\p{Cc}/gu, '')
    .slice(0, 10000); // Limit length
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email) {
  if (!email) return '';
  const sanitized = email.trim().toLowerCase();
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * TODO: Install DOMPurify for production
 * 
 * Installation:
 * npm install dompurify
 * npm install --save-dev @types/dompurify  // If using TypeScript
 * 
 * Then update this file:
 * 
 * import DOMPurify from 'dompurify';
 * 
 * export function sanitizeHTML(html) {
 *   return DOMPurify.sanitize(html, {
 *     ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'sup', 'sub', 'br', 'p', 'span'],
 *     ALLOWED_ATTR: [],
 *     KEEP_CONTENT: true
 *   });
 * }
 */

/**
 * Alias for test compatibility
 */
export const sanitizeHtml = sanitizeHTML;

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(html) {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}
