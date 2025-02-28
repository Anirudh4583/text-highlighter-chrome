document.addEventListener("DOMContentLoaded", function () {
  const startHighlightingBtn = document.getElementById("start-highlighting");
  const clearHighlightsBtn = document.getElementById("clear-highlights");
  const highlightColorInput = document.getElementById("highlight-color");
  const highlightOpacityInput = document.getElementById("highlight-opacity");
  const opacityValueSpan = document.getElementById("opacity-value");
  const selectionModeRadios = document.getElementsByName("selection-mode");

  // Update opacity value display
  highlightOpacityInput.addEventListener("input", function () {
    opacityValueSpan.textContent = `${highlightOpacityInput.value}%`;
  });

  // Start highlighting mode
  startHighlightingBtn.addEventListener("click", function () {
    const color = highlightColorInput.value;
    const opacity = highlightOpacityInput.value / 100;

    // Get the selected mode
    let selectionMode = "element";
    for (const radio of selectionModeRadios) {
      if (radio.checked) {
        selectionMode = radio.value;
        break;
      }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "startHighlighting",
        color: color,
        opacity: opacity,
        selectionMode: selectionMode,
      });
      window.close(); // Close the popup to let the user highlight text
    });
  });

  // Clear all highlights
  clearHighlightsBtn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "clearHighlights",
      });
    });
  });
});
