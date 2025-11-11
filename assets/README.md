# Assets Directory

This directory contains static assets and test files for the AI Doc Prep project.

## Structure

```
assets/
└── test/           # Test files for development and testing
    └── sample.pdf  # Minimal test PDF (1 page, 572 bytes)
```

## Test Files

### sample.pdf
- **Purpose:** Development and testing of PDF to Markdown conversion
- **Size:** 572 bytes (1 page)
- **Content:** Simple text "This is a test PDF for AI Doc Prep"
- **Use:** Quick testing without needing to upload large files

## Usage

**For Development:**
```bash
# Use the sample PDF for testing the conversion tool
# File location: /assets/test/sample.pdf
```

**For Adding More Test Files:**
1. Add files to the appropriate subdirectory
2. Update this README with file descriptions
3. Keep test files small (< 1MB) for fast testing
4. Use meaningful names that describe the test case

## Guidelines

- **Test files should be committed** to the repository for consistent testing
- Keep files small for quick iteration
- Document any special test cases or edge cases
- Use descriptive filenames (e.g., `sample-multipage.pdf`, `sample-scanned.pdf`)

## Future Test Files

Consider adding:
- Multi-page PDF
- PDF with images
- Scanned PDF (for OCR testing)
- PDF with tables
- PDF with forms
- Large PDF (for size limit testing)

---

**Last Updated:** 2025-11-11
