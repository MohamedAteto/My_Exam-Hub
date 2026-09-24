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
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html; // Parse HTML
  
  // Remove script tags
  const scripts = temp.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // Remove dangerous attributes
  const allElements = temp.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i];
    
    // Remove event handler attributes
    const attrs = Array.from(element.attributes);
    for (const attr of attrs) {
      if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
        element.removeAttribute(attr.name);
      }
      // Remove href with javascript:
      if (attr.name === 'href' && attr.value.includes('javascript:')) {
        element.removeAttribute('href');
      }
    }
  }
  
  return temp.innerHTML;
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
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
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
