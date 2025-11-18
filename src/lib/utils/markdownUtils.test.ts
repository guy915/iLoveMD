import { describe, it, expect } from 'vitest'
import { cleanupPdfMarkdown } from './markdownUtils'

describe('markdownUtils', () => {
  describe('cleanupPdfMarkdown', () => {
    describe('with pageFormat: "none"', () => {
      it('should remove all page markers and trim', () => {
        const input = `{0}------------------------------------------------
### Title

Content here

{1}------------------------------------------------

More content

{2}------------------------------------------------

Final content`

        const result = cleanupPdfMarkdown(input, 'none')

        expect(result).toBe(`### Title

Content here

More content

Final content`)
      })

      it('should handle empty string', () => {
        expect(cleanupPdfMarkdown('', 'none')).toBe('')
      })

      it('should trim leading and trailing whitespace', () => {
        const input = `

{0}------------------------------------------------
Content

   `

        const result = cleanupPdfMarkdown(input, 'none')
        expect(result).toBe('Content')
      })

      it('should handle markdown without any page markers', () => {
        const input = `### Title

Content`

        const result = cleanupPdfMarkdown(input, 'none')
        expect(result).toBe(input)
      })
    })

    describe('with pageFormat: "separators_only"', () => {
      it('should replace page markers with separators', () => {
        const input = `{0}------------------------------------------------
### Data Mining CSE2525
Nov 10, 2025 -2026

{1}------------------------------------------------



{2}------------------------------------------------

### Sicco Verwer

{3}------------------------------------------------

### Avishek Anand

{4}------------------------------------------------

### Nergis Tömen`

        const result = cleanupPdfMarkdown(input, 'separators_only')

        expect(result).toBe(`### Data Mining CSE2525
Nov 10, 2025 -2026

---

---

### Sicco Verwer

---

### Avishek Anand

---

### Nergis Tömen`)
      })

      it('should remove first marker and add separators for rest', () => {
        const input = `{0}------------------------------------------------
Page 0 content

{1}------------------------------------------------
Page 1 content

{2}------------------------------------------------
Page 2 content`

        const result = cleanupPdfMarkdown(input, 'separators_only')

        expect(result).toBe(`Page 0 content

---

Page 1 content

---

Page 2 content`)
      })

      it('should handle single marker', () => {
        const input = `{0}------------------------------------------------
Only content`

        const result = cleanupPdfMarkdown(input, 'separators_only')
        expect(result).toBe('Only content')
      })

      it('should handle empty pages between markers', () => {
        const input = `{0}------------------------------------------------
First page

{1}------------------------------------------------

{2}------------------------------------------------
Third page`

        const result = cleanupPdfMarkdown(input, 'separators_only')

        expect(result).toBe(`First page

---

---

Third page`)
      })
    })

    describe('with pageFormat: "with_numbers"', () => {
      it('should replace page markers with page numbers and separators', () => {
        const input = `{0}------------------------------------------------
### Data Mining CSE2525
Nov 10, 2025 -2026

{1}------------------------------------------------



{2}------------------------------------------------

### Sicco Verwer

{3}------------------------------------------------

### Avishek Anand

{4}------------------------------------------------

### Nergis Tömen`

        const result = cleanupPdfMarkdown(input, 'with_numbers')

        expect(result).toBe(`### Data Mining CSE2525
Nov 10, 2025 -2026

Page 1

---

Page 2

---

### Sicco Verwer

Page 3

---

### Avishek Anand

Page 4

---

### Nergis Tömen

Page 5`)
      })

      it('should add page numbers with separators between them', () => {
        const input = `{0}------------------------------------------------
Page 0 content

{1}------------------------------------------------
Page 1 content

{2}------------------------------------------------
Page 2 content`

        const result = cleanupPdfMarkdown(input, 'with_numbers')

        expect(result).toBe(`Page 0 content

Page 1

---

Page 1 content

Page 2

---

Page 2 content

Page 3`)
      })

      it('should handle single marker', () => {
        const input = `{0}------------------------------------------------
Only content`

        const result = cleanupPdfMarkdown(input, 'with_numbers')
        // With only {0}, there's no next page, so no page number added
        expect(result).toBe('Only content')
      })

      it('should add final page number at the end', () => {
        const input = `{0}------------------------------------------------
First

{1}------------------------------------------------
Second

{2}------------------------------------------------
Third`

        const result = cleanupPdfMarkdown(input, 'with_numbers')

        expect(result).toBe(`First

Page 1

---

Second

Page 2

---

Third

Page 3`)
      })

      it('should handle empty pages between markers', () => {
        const input = `{0}------------------------------------------------
First page

{1}------------------------------------------------

{2}------------------------------------------------

{3}------------------------------------------------
Fourth page`

        const result = cleanupPdfMarkdown(input, 'with_numbers')

        expect(result).toBe(`First page

Page 1

---

Page 2

---

Page 3

---

Fourth page

Page 4`)
      })
    })

    describe('edge cases', () => {
      it('should handle markers with varying dash counts', () => {
        const input = `{0}---
Content 1

{1}------------------------------------------------
Content 2

{2}------
Content 3`

        const result = cleanupPdfMarkdown(input, 'separators_only')

        expect(result).toBe(`Content 1

---

Content 2

---

Content 3`)
      })

      it('should normalize excessive newlines', () => {
        const input = `{0}------------------------------------------------


### Title



Content


{1}------------------------------------------------



More`

        const result = cleanupPdfMarkdown(input, 'separators_only')

        expect(result).toBe(`### Title

Content

---

More`)
      })

      it('should handle markers at the very end', () => {
        const input = `{0}------------------------------------------------
Content

{1}------------------------------------------------`

        const result = cleanupPdfMarkdown(input, 'with_numbers')

        expect(result).toBe(`Content

Page 1

---

Page 2`)
      })

      it('should preserve markdown formatting within content', () => {
        const input = `{0}------------------------------------------------
# Heading

**Bold text**

- List item 1
- List item 2

{1}------------------------------------------------

\`\`\`javascript
code block
\`\`\`

{2}------------------------------------------------

[Link](https://example.com)`

        const result = cleanupPdfMarkdown(input, 'with_numbers')

        expect(result).toBe(`# Heading

**Bold text**

- List item 1
- List item 2

Page 1

---

\`\`\`javascript
code block
\`\`\`

Page 2

---

[Link](https://example.com)

Page 3`)
      })
    })
  })
})
