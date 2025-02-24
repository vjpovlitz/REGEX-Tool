document.addEventListener('DOMContentLoaded', function() {
  try {
    const predefinedPatterns = {
      email: '\b[\\w.-]+@[\\w.-]+\\.\\w+\b',
      phone: '\b\\d{3}-\\d{3}-\\d{4}\b',
      number: '\b\\d+\b',
      date: '\b\\d{2}/\\d{2}/\\d{4}\b',
      url: '\bhttps?:\\/\\/\\S+\b',
      ip: '\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\b'
    };

    const sampleText = document.getElementById('sample-text');
    const instructions = document.getElementById('instructions');
    const captureList = document.getElementById('capture-list');
    const generatedRegex = document.getElementById('generated-regex');
    const preview = document.getElementById('preview');
    let selectors = [];
    let pendingSelectionStart = null;
    let currentSelector = null;
    let selectedText = ''; // Add the selectedText variable
    let pendingSelectionEnd = null; // New variable to store the end position
    let lastFocusedCapture = null; // Variable to store the last focused capture input
    let leftBoundPosition = null;
    let rightBoundPosition = null;
    let leftBoundMarker = null;
    let rightBoundMarker = null;

	  // Context Menu Elements
	  const contextMenu = document.getElementById('context-menu');
	  const addSelectorContext = document.getElementById('add-selector-context');
	  const addCaptureContext = document.getElementById('add-capture-context');

    function escapeRegex(string) {
      // Only escape special regex characters, but don't double-escape
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getCharacterOffset(range) {
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(sampleText);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      const offset = preCaretRange.toString().length;
      console.log('getCharacterOffset - Offset:', offset); // Log the offset
      return offset;
    }

    function createSelector(start, end) {
      try {
        console.log('createSelector - Start:', start, 'End:', end); // Log start and end positions

        // Get the text between the bounds
        const text = sampleText.innerText.slice(start, end);
        console.log('Selected text:', text); // Log the extracted text

        if (!text) {
          showError('No text selected for capture. Please select a range of text.');
          return; // Exit if no text is selected
        }

        // Clear existing selectors
        selectors.forEach(selector => {
          selector.elements.forEach(element => element.remove());
        });
        selectors = [];
        clearBoundMarkers(); // Clear bound markers

        const range = document.createRange();
        if (sampleText.firstChild) {
          range.setStart(sampleText.firstChild, start);
          range.setEnd(sampleText.firstChild, end);
        } else {
          console.warn('Sample text has no content');
          return;
        }

        const rects = range.getClientRects();
        const containerRect = sampleText.getBoundingClientRect();
        const selectorParts = [];

        console.log('rects:', rects); // Log rects
        console.log('containerRect:', containerRect); // Log containerRect

        // Create visual selector elements
        for (let rect of rects) {
          const selectorPart = document.createElement('div');
          selectorPart.className = 'selector';
          // Debugging position values
          console.log('rect:', rect);
          console.log('containerRect:', containerRect);
          console.log('Calculation: rect.left - containerRect.left:', rect.left - containerRect.left);
          console.log('Calculation: rect.top - containerRect.top:', rect.top - containerRect.top);

          selectorPart.style.left = `${rect.left - containerRect.left}px`;
          selectorPart.style.top = `${rect.top - containerRect.top}px`;
          selectorPart.style.width = `${rect.width}px`;
          selectorPart.style.height = `${rect.height}px`;
          sampleText.appendChild(selectorPart);
          selectorParts.push(selectorPart);
          console.log('Selector part style - Left:', selectorPart.style.left, 'Top:', selectorPart.style.top); // Log selector part position
        }

        const selector = { start, end, elements: selectorParts };
        selectors.push(selector);

        // Automatically create a capture group with the selected text
        createCapture(text);
        
        updateRegex();
      } catch (error) {
        showError(`Selector error: ${error.message}`, error.stack);
      }
    }

    function createBoundMarker(charPosition, isLeft) {
      try {
        const range = document.createRange();
        if (!sampleText.firstChild) return null;

        range.setStart(sampleText.firstChild, charPosition);
        range.setEnd(sampleText.firstChild, charPosition);
        const rect = range.getBoundingClientRect();
        const containerRect = sampleText.getBoundingClientRect();

        const marker = document.createElement('div');
        marker.className = isLeft ? 'left-bound-marker' : 'right-bound-marker';
        
        // Calculate position relative to the container
        const left = rect.left - containerRect.left;
        const top = rect.bottom - containerRect.top;
        
        marker.style.position = 'absolute';
        marker.style.left = `${left}px`;
        marker.style.top = `${top}px`;
        
        console.log(`Creating ${isLeft ? 'left' : 'right'} marker at:`, { left, top });
        
        sampleText.appendChild(marker);
        return marker;
      } catch (error) {
        console.error('Error creating bound marker:', error);
        return null;
      }
    }

    function clearBoundMarkers() {
      if (leftBoundMarker) {
        leftBoundMarker.remove();
        leftBoundMarker = null;
      }
      if (rightBoundMarker) {
        rightBoundMarker.remove();
        rightBoundMarker = null;
      }
    }

    function createCapture(text = '', name = `Capture${document.querySelectorAll('.capture').length + 1}`) {
      console.log('Creating new capture with text:', text);
      
      // Create capture container
      const captureDiv = document.createElement('div');
      captureDiv.className = 'capture';

      // Create text input
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'capture-text';
      textInput.value = text;
      textInput.placeholder = 'Capture text';
      captureDiv.appendChild(textInput);

      // Create type selector
      const typeSelect = document.createElement('select');
      typeSelect.className = 'capture-type';
      const options = [
        { value: 'literal', text: 'Literal' },
        { value: 'email', text: 'Email' },
        { value: 'phone', text: 'Phone Number' },
        { value: 'number', text: 'Number' },
        { value: 'date', text: 'Date' },
        { value: 'url', text: 'URL' },
        { value: 'ip', text: 'IP Address' },
        { value: 'custom', text: 'Custom' },
      ];
      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        typeSelect.appendChild(optionElement);
      });
      captureDiv.appendChild(typeSelect);

      // Create custom pattern input
      const customInput = document.createElement('input');
      customInput.type = 'text';
      customInput.className = 'custom-pattern';
      customInput.placeholder = 'Custom .NET regex';
      customInput.style.display = 'none';
      captureDiv.appendChild(customInput);

      // Create error display
      const errorSpan = document.createElement('span');
      errorSpan.className = 'error-message';
      captureDiv.appendChild(errorSpan);

      // Create remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'action-button remove-button';
      removeBtn.innerHTML = `
        <span aria-hidden="true">Remove</span>
        <span></span>
        <span>Remove</span>
      `;
      captureDiv.appendChild(removeBtn);

      // Add event listeners
      textInput.addEventListener('input', function() {
        console.log('Capture text changed:', this.value);
        validateCaptureText(textInput);
        updateRegex();
      });

      typeSelect.addEventListener('change', function() {
        customInput.style.display = this.value === 'custom' ? 'inline' : 'none';
        validateCaptureText(textInput);
        validateCustomRegex(customInput);
        updateRegex();
      });

      customInput.addEventListener('input', function() {
        validateCustomRegex(customInput);
        updateRegex();
      });

      removeBtn.addEventListener('click', function() {
        captureDiv.remove();
        updateRegex();
      });

      // Add to DOM and update
      captureList.appendChild(captureDiv);
      textInput.focus();
      updateRegex();
      return captureDiv;
    }

    function debounce(func, wait) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          func.apply(context, args);
        }, wait);
      };
    }

    function generateDotNetRegex() {
      console.log('Generating .NET regex pattern...');
      const patterns = [];

      // Get flags
      const flagI = document.getElementById('flag-i').checked;
      const flagG = document.getElementById('flag-g').checked;
      const flagM = document.getElementById('flag-m').checked;
      const flagS = document.getElementById('flag-s').checked;

      // Build flags string
      let flags = '';
      if (flagI) flags += 'i';
      if (flagG) flags += 'g';
      if (flagM) flags += 'm';
      if (flagS) flags += 's';

      console.log('Active flags:', flags);

      // Get the capture handling type
      const captureHandling = document.getElementById('capture-handling').value;
      console.log('Capture handling mode:', captureHandling);

      // Get all captures and log them for debugging
      const captures = document.querySelectorAll('.capture');
      console.log('Number of captures found:', captures.length);

      captures.forEach((capture, index) => {
        const text = capture.querySelector('.capture-text').value.trim();
        const type = capture.querySelector('.capture-type').value;
        const errorSpan = capture.querySelector('.error-message');
        console.log(`Processing capture ${index + 1}:`, { text, type });

        let pattern;
        if (type === 'literal' || type === 'custom') {
          if (text.match(/\\[wdsWDS]/)) {
            pattern = text;
          } else {
            pattern = type === 'literal' ? escapeRegex(text) : text;
          }

          if (type === 'custom') {
            try {
              new RegExp(pattern);
              errorSpan.textContent = '';
            } catch (e) {
              errorSpan.textContent = 'Invalid regex: ' + e.message;
              console.error('Custom pattern error:', e);
              return;
            }
          }
        } else if (predefinedPatterns[type]) {
          pattern = predefinedPatterns[type];
        }

        if (pattern) {
          patterns.push(pattern);
          console.log(`Added pattern ${index + 1}:`, pattern);
        }
      });

      // Update the generated regex display
      if (patterns.length === 0) {
        generatedRegex.value = '';
        generatedRegex.textContent = '';
        console.log('No patterns generated');
      } else {
        let finalPattern;
        switch (captureHandling) {
          case 'or':
            finalPattern = `(${patterns.join('|')})`;
            break;
          case 'and':
            finalPattern = `(${patterns.join(')(')})`;
            break;
          case 'between':
            finalPattern = `(${patterns.join('}).*?(')})`;
            break;
        }

        // Add flags to the pattern display
        const displayPattern = flags ? `/${finalPattern}/${flags}` : finalPattern;
        generatedRegex.value = displayPattern;
        generatedRegex.textContent = displayPattern;
        console.log('Final pattern with flags:', displayPattern);
      }

      // Update preview with the new pattern and flags
      const previewPattern = generatedRegex.value || generatedRegex.textContent;
      console.log('Updating preview with pattern:', previewPattern);
      updatePreview(previewPattern, flags);
    }

    function updateRegex() {
      clearErrors();
      generateDotNetRegex();
    }

    function updatePreview(pattern, flags) {
      clearErrors();
      if (!pattern || !sampleText.textContent.trim()) {
        preview.innerHTML = sampleText.textContent;
        return;
      }

      try {
        const text = sampleText.textContent;
        console.log('Preview text:', text);
        console.log('Using pattern:', pattern, 'with flags:', flags);

        // Extract the pattern from the /pattern/flags format if present
        let regexPattern = pattern;
        if (pattern.startsWith('/') && pattern.includes('/', 1)) {
          regexPattern = pattern.slice(1, pattern.lastIndexOf('/'));
        }

        // Always include 'g' flag for matchAll to work
        const regexFlags = flags ? flags + (flags.includes('g') ? '' : 'g') : 'g';
        console.log('Using flags:', regexFlags);

        const regex = new RegExp(regexPattern, regexFlags);
        const matches = Array.from(text.matchAll(regex));
        console.log('Matches found:', matches);

        let lastIndex = 0;
        let result = '';

        for (const match of matches) {
          const index = match.index;
          // Add text before match
          result += escapeHtml(text.slice(lastIndex, index));
          // Add highlighted match
          result += `<span class="highlight">${escapeHtml(match[0])}</span>`;
          lastIndex = index + match[0].length;
        }
        // Add remaining text
        result += escapeHtml(text.slice(lastIndex));

        preview.innerHTML = result;
      } catch (error) {
        console.error('Preview error:', error);
        preview.innerHTML = `<span class="error">Preview error: ${error.message}</span>`;
      }
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const errorDisplay = document.getElementById('error-display');
    errorDisplay.style.display = 'none';

    function showError(message, stack = '') {
      errorDisplay.style.display = 'block';
      errorDisplay.innerHTML = `
        <div class=\"error-message\">
          <p>${message}</p>
          <pre>${stack}</pre>
        </div>
      `;
      setTimeout(() => errorDisplay.style.display = 'none', 5000);
    }

    function clearErrors() {
      errorDisplay.innerHTML = '';
      errorDisplay.style.display = 'none';
    }

    function showDebugInfo(message) {
      const debugItem = document.createElement('div');
      debugItem.className = 'debug-info';
      debugItem.textContent = message;
      errorDisplay.appendChild(debugItem);
      setTimeout(() => debugItem.remove(), 3000);
    }

    function validateCaptureText(textInput) {
      const text = textInput.value.trim();
      const errorSpan = textInput.parentNode.querySelector('.error-message');
      if (text.length > 0) {
        errorSpan.textContent = '';
      } else {
        errorSpan.textContent = 'Capture text cannot be empty';
      }
    }

    function validateCustomRegex(customInput) {
      const customPattern = customInput.value;
      const errorSpan = customInput.parentNode.querySelector('.error-message');
      try {
        new RegExp(customPattern);
        errorSpan.textContent = '';
      } catch (e) {
        errorSpan.textContent = 'Invalid regex: ' + e.message;
      }
    }
    
    // Preload sample text into the sample text window
    sampleText.innerText = "Smokey the Superdog, terrified of kittens despite his powers, faced a burning building with trapped felines inside. He bravely flew in, found the scared kittens amidst the flames, scooped them up, and leaped out just as the structure collapsed. Landing safely, the grateful kittens nuzzled him, and Smokey realized he'd conquered his fear while saving the day.";

    sampleText.addEventListener('contextmenu', function(event) {
      event.preventDefault();
      const selection = window.getSelection();
      let charPosition = 0;

      if (selection.rangeCount > 0 && sampleText.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        charPosition = getCharacterOffset(range);
        console.log('Contextmenu - Selection charPosition:', charPosition);
      } else {
        const tempRange = document.caretRangeFromPoint(event.clientX, event.clientY);
        if (tempRange && sampleText.contains(tempRange.startContainer)) {
          charPosition = getCharacterOffset(tempRange);
          console.log('Contextmenu - Click charPosition:', charPosition);
        } else {
          console.warn('Right-click outside sampleText or unable to get position.');
          return;
        }
      }

      // Show context menu at click position
      contextMenu.style.display = 'block';
      contextMenu.style.left = event.pageX + 'px';
      contextMenu.style.top = event.pageY + 'px';

      // Handle bound setting
      if (leftBoundPosition === null) {
        leftBoundPosition = charPosition;
        clearBoundMarkers();
        leftBoundMarker = createBoundMarker(charPosition, true);
        instructions.textContent = 'Left bound set. Right-click again to set the right bound.';
        console.log('Left bound set at:', leftBoundPosition);
      } else {
        rightBoundPosition = charPosition;
        rightBoundMarker = createBoundMarker(charPosition, false);
        instructions.textContent = 'Bounds set. Click "Add Selector" to create capture.';
        console.log('Right bound set at:', rightBoundPosition);
      }
    });

    // Hide context menu when clicking outside
    document.addEventListener('click', function(event) {
      if (!contextMenu.contains(event.target)) {
        contextMenu.style.display = 'none';
      }
    });

    // Track text selection
    sampleText.addEventListener('mouseup', function() {
      const selection = window.getSelection();
      if (selection.toString().trim()) {
        selectedText = selection.toString();
        const start = selection.anchorOffset;
        const end = selection.focusOffset;
        pendingSelectionStart = Math.min(start, end);
        pendingSelectionEnd = Math.max(start, end);
        showDebugInfo(`Selection: ${selectedText.slice(0, 50)}`);
      }
    });

    // Update regex on sample text changes
    sampleText.addEventListener('input', function() {
      updateRegex();
      if (sampleText.textContent.trim() === "") {
        document.getElementById('capture-list').innerHTML = "";
        preview.innerHTML = '';
      }
    });

    // Context Menu Actions
    addSelectorContext.addEventListener('click', function() {
      if (leftBoundPosition === null) {
        instructions.textContent = 'Right-click in the sample text first to set the left bound.';
        return;
      }

      if (rightBoundPosition === null) {
        instructions.textContent = 'Right-click again to set the right bound.';
        return;
      }

      const start = Math.min(leftBoundPosition, rightBoundPosition);
      const end = Math.max(leftBoundPosition, rightBoundPosition);

      if (start === end) {
        showError('Please select a range of text, not just a single point.');
        return;
      }

      const text = sampleText.innerText.slice(start, end);
      console.log('Selected text:', text);

      if (!text) {
        showError('No text selected for capture. Please select a range of text.');
        return;
      }

      createCapture(text);

      // Reset selection state
      leftBoundPosition = null;
      rightBoundPosition = null;
      clearBoundMarkers();
      instructions.textContent = 'Right-click to set bounds or select text to add captures.';
      contextMenu.style.display = 'none';
    });

    addCaptureContext.addEventListener('click', function() {
      if (selectedText && selectedText.trim()) {
        createCapture(selectedText.trim());
        contextMenu.style.display = 'none';
        window.getSelection().removeAllRanges();
      } else {
        showError('Please select some text first');
      }
    });

    // Update regex when flags change
    document.querySelectorAll('#flags-section input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        console.log(`Flag ${this.id} changed to:`, this.checked);
        updateRegex();
      });
    });

    // Export regex pattern
    document.getElementById('export-regex').addEventListener('click', function() {
      try {
        const pattern = generatedRegex.textContent;
        if (!pattern || pattern === '(?:)') {
          showError('No valid regex to export');
          return;
        }

        const blob = new Blob([pattern], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `regex-pattern-${new Date().toISOString().slice(0,10)}.regex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showDebugInfo('Regex pattern exported successfully');
      } catch (error) {
        showError(`Export failed: ${error.message}`, error.stack);
      }
    });

    // Copy regex pattern
    document.getElementById('copy-regex').addEventListener('click', function() {
      try {
        const pattern = generatedRegex.textContent;
        if (!pattern || pattern === '(?:)') {
          showError('No valid regex to copy');
          return;
        }

        navigator.clipboard.writeText(pattern).then(
          function() {
            const originalText = this.innerHTML;
            this.innerHTML = `
              <span aria-hidden="true"><i class="fas fa-check"></i> Copied!</span>
              <span></span>
              <span><i class="fas fa-check"></i> Copied!</span>
            `;
            
            setTimeout(() => {
              this.innerHTML = `
                <span aria-hidden="true"><i class="fas fa-copy"></i> Copy Regex</span>
                <span></span>
                <span><i class="fas fa-copy"></i> Copy Regex</span>
              `;
            }, 2000);
            
            showDebugInfo('Regex pattern copied to clipboard');
          }.bind(this),
          function(err) {
            showError('Failed to copy: ' + err);
          }
        );
      } catch (error) {
        showError(`Copy failed: ${error.message}`, error.stack);
      }
    });

    // Update regex when capture handling changes
    document.getElementById('capture-handling').addEventListener('change', function() {
      console.log('Capture handling changed to:', this.value);
      updateRegex();
    });

    // Add Capture button functionality
    document.getElementById('add-capture').addEventListener('click', function() {
      document.getElementById('regex-keyboard').style.display = 'block'; // Show the keyboard
      createCapture();
    });

    // Update lastFocusedCapture when a capture input is focused
    document.addEventListener('focusin', function(e) {
      if (e.target && e.target.classList.contains('capture-text')) {
        lastFocusedCapture = e.target;
      }
    });

    // Add event listener for the regex keyboard's close button
    const keyboardCloseBtn = document.createElement('button');
    keyboardCloseBtn.id = 'regex-keyboard-close';
    keyboardCloseBtn.className = 'action-button';
    keyboardCloseBtn.innerHTML = `
      <span aria-hidden="true">Close</span>
      <span></span>
      <span>Close</span>
    `;
    document.getElementById('regex-keyboard').appendChild(keyboardCloseBtn);

    keyboardCloseBtn.addEventListener('click', function() {
      document.getElementById('regex-keyboard').style.display = 'none';
    });

    // For each regex key, add an event handler
    document.querySelectorAll('.regex-key').forEach(button => {
      button.addEventListener('click', function() {
        const char = this.getAttribute('data-char');
        if (lastFocusedCapture) {
          const start = lastFocusedCapture.selectionStart;
          const end = lastFocusedCapture.selectionEnd;
          const currentValue = lastFocusedCapture.value;
          lastFocusedCapture.value = currentValue.slice(0, start) + char + currentValue.slice(end);
          lastFocusedCapture.selectionStart = lastFocusedCapture.selectionEnd = start + char.length;
          lastFocusedCapture.focus();
          // Trigger the input event to update the regex
          lastFocusedCapture.dispatchEvent(new Event('input'));
        }
      });
    });

    // Initial regex update
    updateRegex();
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
    showError('Initialization error: ' + error.message);
  }
});