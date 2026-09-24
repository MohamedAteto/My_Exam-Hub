import { describe, it, expect } from 'vitest';
import { sanitizeHtml, stripHtml } from './sanitize';

describe('Sanitize Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should preserve safe HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const output = sanitizeHtml(input);
      
      expect(output).toContain('<p>');
      expect(output).toContain('<strong>');
      expect(output).toContain('Hello');
      expect(output).toContain('World');
    });

    it('should remove script tags', () => {
      const input = '<p>Safe content</p><script>alert("XSS")</script>';
      const output = sanitizeHtml(input);
      
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
      expect(output).toContain('Safe content');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const output = sanitizeHtml(input);
      
      expect(output).not.toContain('onclick');
      expect(output).toContain('Click me');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      const output = sanitizeHtml(input);
      
      expect(output).not.toContain('javascript:');
      expect(output).toContain('Link');
    });

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
    });

    it('should preserve safe links', () => {
      const input = '<a href="https://example.com">Safe Link</a>';
      const output = sanitizeHtml(input);
      
      expect(output).toContain('href');
      expect(output).toContain('example.com');
    });
  });

  describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const output = stripHtml(input);
      
      expect(output).toBe('Hello World');
    });

    it('should remove nested tags', () => {
      const input = '<div><p>Test <span>content</span></p></div>';
      const output = stripHtml(input);
      
      expect(output).toBe('Test content');
    });

    it('should handle self-closing tags', () => {
      const input = 'Line 1<br/>Line 2';
      const output = stripHtml(input);
      
      expect(output).toBe('Line 1Line 2');
    });

    it('should handle empty string', () => {
      expect(stripHtml('')).toBe('');
    });

    it('should handle plain text', () => {
      const input = 'Just plain text';
      expect(stripHtml(input)).toBe('Just plain text');
    });

    it('should handle null/undefined', () => {
      expect(stripHtml(null)).toBe('');
      expect(stripHtml(undefined)).toBe('');
    });

    it('should decode HTML entities', () => {
      const input = '&lt;div&gt;Hello&amp;World&lt;/div&gt;';
      const output = stripHtml(input);
      
      expect(output).toBe('<div>Hello&World</div>');
    });
  });
});
