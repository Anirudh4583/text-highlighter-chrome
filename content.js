// State variables
let isHighlightingMode = false;
let highlightColor = "#FFFF00";
let highlightOpacity = 0.5;
let highlightedElements = [];
let selectionMode = "element"; // 'element' or 'text'
let currentSelection = null;
let originalEventListeners = {};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "startHighlighting") {
    highlightColor = message.color || highlightColor;
    highlightOpacity = message.opacity || highlightOpacity;
    selectionMode = message.selectionMode || "element";
    enableHighlightingMode();
  } else if (message.action === "clearHighlights") {
    clearAllHighlights();
  }
});

// Enable highlighting mode
function enableHighlightingMode() {
  isHighlightingMode = true;
  document.body.style.cursor = "pointer";

  // Add a visual indicator that highlighting mode is active
  const indicator = document.createElement("div");
  indicator.id = "highlight-mode-indicator";
  indicator.textContent = `Highlighting Mode Active (${
    selectionMode === "element" ? "Element" : "Text"
  } mode, ESC to exit)`;
  document.body.appendChild(indicator);

  // Add event listeners
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("click", handleClick, true); // Capture phase to prevent link navigation

  // Disable mouse events only in element mode
  if (selectionMode === "element") {
    disableAllMouseEvents();
  } else {
    // In text mode, we only need to prevent link navigation and default actions
    document.addEventListener("click", preventDefaultForLinks, true);
  }

  // Add selection change listener for text selection mode
  if (selectionMode === "text") {
    document.addEventListener("selectionchange", handleSelectionChange);
  }
}

// Prevent default for links but allow text selection
function preventDefaultForLinks(e) {
  if (!isHighlightingMode) return;

  // Check if the target is a link or inside a link
  let currentElement = e.target;
  while (currentElement) {
    if (currentElement.tagName === "A") {
      e.preventDefault();
      e.stopPropagation();
      break;
    }
    currentElement = currentElement.parentElement;
  }
}

// Disable all mouse events that could interfere with highlighting
function disableAllMouseEvents() {
  // List of all mouse events to disable
  const mouseEvents = [
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "contextmenu",
    "mouseover",
    "mouseout",
    "mouseenter",
    "mouseleave",
    "mousemove",
  ];

  // Create a handler for all events
  const preventDefaultHandler = function (e) {
    if (isHighlightingMode && selectionMode === "element") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  };

  // Add the handler to the document for all events in capture phase
  mouseEvents.forEach((eventType) => {
    document.addEventListener(eventType, preventDefaultHandler, true);

    // Store the handler for later removal
    if (!originalEventListeners[eventType]) {
      originalEventListeners[eventType] = [];
    }
    originalEventListeners[eventType].push(preventDefaultHandler);
  });

  // Disable all onclick attributes
  disableInlineEventHandlers();
}

// Disable inline event handlers (onclick, onmousedown, etc.)
function disableInlineEventHandlers() {
  // Get all elements in the document
  const allElements = document.querySelectorAll("*");

  // List of all inline mouse event attributes to disable
  const mouseEventAttributes = [
    "onclick",
    "onmousedown",
    "onmouseup",
    "ondblclick",
    "oncontextmenu",
    "onmouseover",
    "onmouseout",
    "onmouseenter",
    "onmouseleave",
    "onmousemove",
  ];

  // For each element, store and remove all inline event handlers
  allElements.forEach((element) => {
    // Skip our own UI elements
    if (element.id === "highlight-mode-indicator") return;

    // Store original handlers and remove them
    mouseEventAttributes.forEach((attr) => {
      if (element[attr]) {
        // Store the original handler
        element.dataset[`original${attr}`] = element[attr];
        // Remove the handler
        element[attr] = null;
      }
    });
  });
}

// Restore inline event handlers
function restoreInlineEventHandlers() {
  // Get all elements in the document
  const allElements = document.querySelectorAll("*");

  // List of all inline mouse event attributes to restore
  const mouseEventAttributes = [
    "onclick",
    "onmousedown",
    "onmouseup",
    "ondblclick",
    "oncontextmenu",
    "onmouseover",
    "onmouseout",
    "onmouseenter",
    "onmouseleave",
    "onmousemove",
  ];

  // For each element, restore all inline event handlers
  allElements.forEach((element) => {
    mouseEventAttributes.forEach((attr) => {
      const originalAttr = `original${attr}`;
      if (element.dataset[originalAttr]) {
        // Restore the original handler
        try {
          element[attr] = new Function(element.dataset[originalAttr]);
        } catch (e) {
          console.error(`Error restoring ${attr} handler:`, e);
        }
        // Remove the stored original
        delete element.dataset[originalAttr];
      }
    });
  });
}

// Handle click events to prevent link navigation
function handleClick(e) {
  if (!isHighlightingMode) return;

  if (selectionMode === "element") {
    // In element mode, prevent all default behaviors
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  } else {
    // In text mode, only prevent navigation for links
    let currentElement = e.target;
    while (currentElement) {
      if (currentElement.tagName === "A") {
        e.preventDefault();
        e.stopPropagation();
        break;
      }
      currentElement = currentElement.parentElement;
    }
  }
}

// Handle selection change events
function handleSelectionChange() {
  if (!isHighlightingMode || selectionMode !== "text") return;
  currentSelection = window.getSelection();
}

// Handle mouseup events for text selection
function handleMouseUp(e) {
  if (!isHighlightingMode) return;

  if (selectionMode === "element") {
    // In element mode, prevent default behavior
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Apply highlight to the element
    const target = e.target;

    // Don't highlight the indicator itself
    if (target.id === "highlight-mode-indicator") return;

    highlightElement(target);
    return false;
  } else {
    // In text mode, allow selection but handle highlighting
    const selection = window.getSelection();
    if (selection.toString().trim() === "") return;

    // Prevent default only for links
    let currentElement = e.target;
    while (currentElement) {
      if (currentElement.tagName === "A") {
        e.preventDefault();
        e.stopPropagation();
        break;
      }
      currentElement = currentElement.parentElement;
    }

    highlightTextSelection(selection);
  }
}

// Highlight text selection
function highlightTextSelection(selection) {
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const uniqueId = createUniqueId();

  // Create a span element to wrap the selected text
  const highlightSpan = document.createElement("span");
  highlightSpan.classList.add("text-highlighter-highlight");
  highlightSpan.dataset.highlightId = uniqueId;
  highlightSpan.style.backgroundColor = hexToRgba(
    highlightColor,
    highlightOpacity
  );

  // Replace the range with our custom span
  try {
    range.surroundContents(highlightSpan);
    // Add to the list of highlighted elements
    highlightedElements.push(highlightSpan);

    // Clear the selection
    selection.removeAllRanges();
  } catch (e) {
    console.error("Error highlighting text selection:", e);
    // This can happen if the selection spans multiple elements
    // In this case, we'll fall back to highlighting the common ancestor
    const commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType === Node.TEXT_NODE) {
      highlightElement(commonAncestor.parentNode);
    } else {
      highlightElement(commonAncestor);
    }
  }
}

// Highlight an element
function highlightElement(element) {
  const uniqueId = createUniqueId();

  // Special handling for input elements
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    // Create a wrapper div if it doesn't exist
    let wrapper = element.parentNode;
    if (!wrapper.classList.contains("text-highlighter-input-wrapper")) {
      wrapper = document.createElement("div");
      wrapper.classList.add("text-highlighter-input-wrapper");
      element.parentNode.insertBefore(wrapper, element);
      wrapper.appendChild(element);
    }

    wrapper.classList.add("text-highlighter-highlight");
    wrapper.dataset.highlightId = uniqueId;
    wrapper.style.backgroundColor = hexToRgba(highlightColor, highlightOpacity);

    // Add to the list of highlighted elements
    highlightedElements.push(wrapper);
  } else {
    // Regular element
    element.classList.add("text-highlighter-highlight");
    element.dataset.highlightId = uniqueId;
    element.style.backgroundColor = hexToRgba(highlightColor, highlightOpacity);

    // Add to the list of highlighted elements
    highlightedElements.push(element);
  }
}

// Handle keydown events
function handleKeyDown(e) {
  if (e.key === "Escape") {
    disableHighlightingMode();
  } else if (e.key === "Tab" && isHighlightingMode) {
    // Toggle between element and text selection modes
    e.preventDefault();
    selectionMode = selectionMode === "element" ? "text" : "element";

    // Update event handlers based on the new mode
    if (selectionMode === "element") {
      disableAllMouseEvents();
      document.removeEventListener("selectionchange", handleSelectionChange);
    } else {
      // Remove all the event handlers we added for element mode
      Object.keys(originalEventListeners).forEach((eventType) => {
        originalEventListeners[eventType].forEach((handler) => {
          document.removeEventListener(eventType, handler, true);
        });
      });

      // Clear the stored handlers
      originalEventListeners = {};

      // Restore inline event handlers
      restoreInlineEventHandlers();

      // Add selection change listener for text mode
      document.addEventListener("selectionchange", handleSelectionChange);

      // Add link prevention
      document.addEventListener("click", preventDefaultForLinks, true);
    }

    // Update the indicator
    const indicator = document.getElementById("highlight-mode-indicator");
    if (indicator) {
      indicator.textContent = `Highlighting Mode Active (${
        selectionMode === "element" ? "Element" : "Text"
      } mode, ESC to exit)`;
    }
  }
}

// Disable highlighting mode
function disableHighlightingMode() {
  isHighlightingMode = false;
  document.body.style.cursor = "auto";

  // Remove the visual indicator
  const indicator = document.getElementById("highlight-mode-indicator");
  if (indicator) {
    indicator.remove();
  }

  // Remove event listeners
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("mouseup", handleMouseUp, true);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("selectionchange", handleSelectionChange);
  document.removeEventListener("click", preventDefaultForLinks, true);

  // Remove all the event handlers we added
  Object.keys(originalEventListeners).forEach((eventType) => {
    originalEventListeners[eventType].forEach((handler) => {
      document.removeEventListener(eventType, handler, true);
    });
  });

  // Clear the stored handlers
  originalEventListeners = {};

  // Restore inline event handlers
  restoreInlineEventHandlers();
}

// Clear all highlights
function clearAllHighlights() {
  highlightedElements.forEach((el) => {
    // Check if it's an input wrapper
    if (el.classList.contains("text-highlighter-input-wrapper")) {
      // Unwrap the input element
      const input = el.firstChild;
      el.parentNode.insertBefore(input, el);
      el.remove();
    } else {
      // Regular element or text span
      el.classList.remove("text-highlighter-highlight");
      el.style.backgroundColor = "";

      // If it's a span we created for text selection, unwrap it
      if (el.tagName === "SPAN" && el.dataset.highlightId) {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    }
  });
  highlightedElements = [];
}

// Create a unique ID for highlighted elements
function createUniqueId() {
  return "highlight-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// Convert hex color to rgba
function hexToRgba(hex, opacity) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Initialize when the content script loads
function initialize() {
  // Create a style element for the indicator and highlights
  const style = document.createElement("style");
  style.textContent = `
    #highlight-mode-indicator {
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      pointer-events: none;
    }
    
    .text-highlighter-highlight {
      transition: background-color 0.2s ease;
    }
    
    .text-highlighter-input-wrapper {
      display: inline-block;
      position: relative;
      padding: 2px;
      border-radius: 2px;
    }
    
    /* Style for placeholder text */
    .text-highlighter-highlight input::placeholder,
    .text-highlighter-highlight textarea::placeholder {
      color: rgba(0, 0, 0, 0.7) !important;
    }
  `;
  document.head.appendChild(style);
}

// Run initialization
initialize();
