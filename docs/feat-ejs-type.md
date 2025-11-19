# Plan: EJS Template Upload UI Enhancement

## Objective
Enhance the "Add New Landing" functionality in `admin.html` to provide a flexible and user-friendly interface for uploading EJS templates. The UI should support uploading:
1.  A single `.ejs` file.
2.  Multiple `.ejs` files.
3.  Folders containing `.ejs` files (indirectly via ZIP or by instructing users).
4.  A `.zip` file containing `.ejs` files and/or folders.

## Current UI Context
*   The `admin.html` uses Vue 3, Tailwind CSS, and CodeMirror.
*   The "Add New Landing" modal has a "Type" selection, including "EJS Template".
*   The "EJS Template" type currently presents a single file input (`<input type="file" multiple accept=".ejs,.html">`).

## Proposed UI/UX Enhancements

### 1. "EJS Template" Type Selection
When "EJS Template" is selected in the "Type" dropdown:

#### Option A: Direct File Upload (Existing - Enhanced Instructions)
*   **Input:** Retain the existing `<input type="file" :multiple="true" accept=".ejs,.html">`.
*   **Label:** Update the label to clearly indicate multiple file selection: "Upload EJS files (select one or multiple `.ejs` files)".
*   **Instructions:** Add a small descriptive text below the input: "You can select individual `.ejs` files. If your template has partials or includes, consider zipping them up and using the 'Upload ZIP' option below."

#### Option B: ZIP File Upload
*   **Input:** Add a new `<input type="file" accept=".zip">` specifically for ZIP files.
*   **Label:** "Upload EJS Template as ZIP file".
*   **Instructions:** Add descriptive text: "Upload a `.zip` archive containing your `index.ejs` (main template) and any related `.ejs` partials or folders. The `index.ejs` file should be at the root of the zip archive or in a clearly defined subfolder (e.g., `template/index.ejs`)."

#### User Choice / Interaction:
*   Users can choose either Option A or Option B.
*   **Constraint:** Only one of these inputs should be used at a time. If a user selects files for Option A, and then selects a ZIP for Option B, the Option A selection should be cleared, and vice-versa. This can be handled in the Vue logic.

### 2. Form Submission Logic (`addLanding` method)

The `addLanding` method in the Vue instance will need modifications:

*   **File Handling:**
    *   Currently, it checks `this.$refs.fileInput && this.$refs.fileInput.files.length > 0`. This needs to be extended to check both the multi-file input and the new zip-file input.
    *   Determine if the uploaded files are individual EJS files or a single ZIP file.
    *   The `formData.append('files', file)` loop will need to accommodate the different types.
    *   For ZIP files, the backend logic will need to handle unzipping and processing the contained EJS files. This plan focuses on the UI; backend processing is a separate concern but should be noted.

*   **Type Differentiation:** The `type: 'ejs'` already exists. The backend will need to correctly interpret the uploaded content (either raw EJS files or a ZIP containing EJS files) and deploy them appropriately.

### 3. Visual Layout

*   The two upload options (multi-file and zip) should be clearly separated visually within the "Add New Landing" modal when "EJS Template" is selected. Perhaps using distinct `div` containers with clear headings or separators.
*   Maintain existing Tailwind CSS styling for consistency.

## Example UI Mockup (Conceptual)

```html
<!-- Inside the Add Landing Modal, within the EJS type specific div -->
<div v-if="newLanding.type === 'ejs'">
  <label class="block text-sm font-medium text-gray-700 mb-2">Upload EJS Files</label>
  <input ref="ejsFileInput" type="file" :multiple="true" accept=".ejs" @change="handleEjsFilesChange" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
  <p class="mt-1 text-sm text-gray-500">Select one or multiple individual .ejs files.</p>

  <div class="my-4 border-t border-gray-200"></div> <!-- Separator -->

  <label class="block text-sm font-medium text-gray-700 mb-2">Upload EJS Template as ZIP file</label>
  <input ref="ejsZipInput" type="file" accept=".zip" @change="handleEjsZipChange" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus="ring-blue-500 focus:border-transparent">
  <p class="mt-1 text-sm text-gray-500">Upload a .zip archive containing your index.ejs (main template) and any related .ejs partials or folders.</p>

  <!-- Add some visual feedback for selected files/zip -->
  <div v-if="selectedEjsFiles.length > 0" class="mt-2 text-sm text-gray-600">
    Selected EJS Files: {{ selectedEjsFiles.map(f => f.name).join(', ') }}
  </div>
  <div v-if="selectedEjsZip" class="mt-2 text-sm text-gray-600">
    Selected ZIP File: {{ selectedEjsZip.name }}
  </div>
</div>
```

## Vue Data & Methods Considerations

### Data
*   `selectedEjsFiles: []` to store `File` objects from the multi-file input.
*   `selectedEjsZip: null` to store the `File` object from the zip input.

### Methods
*   `handleEjsFilesChange(event)`:
    *   Sets `selectedEjsFiles` from `event.target.files`.
    *   Clears `selectedEjsZip` and the `ejsZipInput` value.
*   `handleEjsZipChange(event)`:
    *   Sets `selectedEjsZip` from `event.target.files[0]`.
    *   Clears `selectedEjsFiles` and the `ejsFileInput` value.
*   Modify `addLanding` to:
    *   Check `newLanding.type === 'ejs'`.
    *   If `selectedEjsZip` exists, append it to `formData`.
    *   Else if `selectedEjsFiles.length > 0`, append each file from `selectedEjsFiles` to `formData`.
    *   **Important:** The `formData.append('files', file)` key might need to be specific for EJS files vs ZIPs, or the backend needs to inspect content-type/filename. E.g., `formData.append('ejsFiles', file)` or `formData.append('ejsZip', file)`.

## Backend Implications (Brief Note)
*   The API endpoint `/api/landings` will need to be updated to handle the incoming `formData` for `type: 'ejs'`.
*   It must differentiate between multiple individual EJS files and a single ZIP file.
*   For ZIP files, it must extract the contents and correctly identify the main `index.ejs` (or allow configuration for it) and other partials.
*   Error handling for malformed ZIPs or missing `index.ejs` will be crucial.
