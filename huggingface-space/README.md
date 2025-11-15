---
title: Marker PDF Converter
emoji: 📄
colorFrom: blue
colorTo: purple
sdk: docker
sdk_version: "3.10"
app_file: app.py
pinned: false
license: mit
---

# Marker PDF Converter

Convert PDF files to clean, LLM-optimized Markdown using [Marker AI](https://github.com/VikParuchuri/marker).

This Space provides a **FREE REST API** powered by HuggingFace's GPU infrastructure.

## Usage

### API Endpoints

**Convert PDF:**
```bash
POST https://YOUR-USERNAME-marker-pdf-converter.hf.space/marker
```

**Check Status:**
```bash
GET https://YOUR-USERNAME-marker-pdf-converter.hf.space/status/{request_id}
```

### Example

```python
import requests

# Upload PDF
with open("document.pdf", "rb") as f:
    response = requests.post(
        "https://YOUR-USERNAME-marker-pdf-converter.hf.space/marker",
        files={"file": f},
        data={
            "output_format": "markdown",
            "paginate": "false"
        }
    )

request_id = response.json()["request_id"]

# Poll for result
import time
while True:
    status_response = requests.get(
        f"https://YOUR-USERNAME-marker-pdf-converter.hf.space/status/{request_id}"
    )
    data = status_response.json()

    if data["status"] == "complete":
        markdown = data["markdown"]
        print(markdown)
        break
    elif data["status"] == "error":
        print(f"Error: {data['error']}")
        break

    time.sleep(2)
```

### JavaScript Example

```javascript
// Upload PDF
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('output_format', 'markdown');

const response = await fetch(
  'https://YOUR-USERNAME-marker-pdf-converter.hf.space/marker',
  {
    method: 'POST',
    body: formData
  }
);

const { request_id } = await response.json();

// Poll for result
while (true) {
  const statusResponse = await fetch(
    `https://YOUR-USERNAME-marker-pdf-converter.hf.space/status/${request_id}`
  );
  const data = await statusResponse.json();

  if (data.status === 'complete') {
    console.log(data.markdown);
    break;
  } else if (data.status === 'error') {
    console.error(data.error);
    break;
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | File | Required | PDF file to convert |
| `output_format` | String | "markdown" | Output format (currently only markdown) |
| `langs` | String | null | Language hints (e.g., "English,Spanish") |
| `paginate` | Boolean | false | Add page separators |
| `disable_image_extraction` | Boolean | false | Skip extracting images |
| `use_llm` | Boolean | false | Use LLM for better quality (slower, requires `api_key`) |
| `api_key` | String | null | Gemini API key (required if `use_llm=true`) |
