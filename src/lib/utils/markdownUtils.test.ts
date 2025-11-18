import { describe, it, expect } from 'vitest'
import { cleanupPdfMarkdown } from './markdownUtils'

describe('markdownUtils', () => {
        describe('cleanupPdfMarkdown', () => {
                // Helper to create a marker with exactly 48 dashes
                const mk = (n: number) => `{${n}}${'-'.repeat(48)}`

                describe('with pageFormat: "none"', () => {
                        it('should remove all page markers and trim', () => {
                                const input = `${mk(0)}
### Title

Content here

${mk(1)}

More content

${mk(2)}

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

${mk(0)}
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
                                const input = `${mk(0)}
### Data Mining CSE2525
Nov 10, 2025 -2026

${mk(1)}



${mk(2)}

### Sicco Verwer

${mk(3)}

### Avishek Anand

${mk(4)}

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
                                const input = `${mk(0)}
Page 0 content

${mk(1)}
Page 1 content

${mk(2)}
Page 2 content`

                                const result = cleanupPdfMarkdown(input, 'separators_only')

                                expect(result).toBe(`Page 0 content

---

Page 1 content

---

Page 2 content`)
                        })

                        it('should handle single marker', () => {
                                const input = `${mk(0)}
Only content`

                                const result = cleanupPdfMarkdown(input, 'separators_only')
                                expect(result).toBe('Only content')
                        })

                        it('should handle empty pages between markers', () => {
                                const input = `${mk(0)}
First page

${mk(1)}

${mk(2)}
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
                                const input = `${mk(0)}
### Data Mining CSE2525
Nov 10, 2025 -2026

${mk(1)}



${mk(2)}

### Sicco Verwer

${mk(3)}

### Avishek Anand

${mk(4)}

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
                                const input = `${mk(0)}
Page 0 content

${mk(1)}
Page 1 content

${mk(2)}
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
                                const input = `${mk(0)}
Only content`

                                const result = cleanupPdfMarkdown(input, 'with_numbers')
                                // With only {0}, add Page 1 at the end
                                expect(result).toBe(`Only content

Page 1`)
                        })

                        it('should add final page number at the end', () => {
                                const input = `${mk(0)}
First

${mk(1)}
Second

${mk(2)}
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
                                const input = `${mk(0)}
First page

${mk(1)}

${mk(2)}

${mk(3)}
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
                        it('should handle markers with varying dash counts (at least 40)', () => {
                                const input = `{0}----------------------------------------
Content 1

{1}------------------------------------------------
Content 2

{2}---------------------------------------
Content 3`

                                // {0} has 40 dashes (valid)
                                // {1} has 48 dashes (valid)
                                // {2} has 39 dashes (invalid)

                                const result = cleanupPdfMarkdown(input, 'separators_only')

                                expect(result).toBe(`Content 1

---

Content 2

{2}---------------------------------------
Content 3`)
                        })
                        it('should normalize excessive newlines', () => {
                                const input = `${mk(0)}


### Title



Content


${mk(1)}



More`

                                const result = cleanupPdfMarkdown(input, 'separators_only')

                                expect(result).toBe(`### Title

Content

---

More`)
                        })

                        it('should handle markers at the very end', () => {
                                const input = `${mk(0)}
Content

${mk(1)}`

                                const result = cleanupPdfMarkdown(input, 'with_numbers')

                                expect(result).toBe(`Content

Page 1

---

Page 2`)
                        })

                        it('should preserve markdown formatting within content', () => {
                                const input = `${mk(0)}
# Heading

**Bold text**

- List item 1
- List item 2

${mk(1)}

\`\`\`javascript
code block
\`\`\`

${mk(2)}

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

