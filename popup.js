document.addEventListener('DOMContentLoaded', () => {
  const openSidebarBtn = document.getElementById('open-sidebar');
  const exportPromptsBtn = document.getElementById('export-prompts'); // Button ID is still 'export-prompts'

  // Open Sidebar Button
  openSidebarBtn.addEventListener('click', () => {
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => { if (tabs && tabs.length > 0 && tabs[0].id) { browser.tabs.sendMessage(tabs[0].id, { action: 'openSidebar' }, (response) => { if (browser.runtime.lastError) { console.warn("Msg Send Error(Open):", browser.runtime.lastError.message); } else { console.log("Open Resp:", response); window.close(); } }); } else { console.error("No active tab."); } });
  });

  // Export (Selected) Prompts Button
  exportPromptsBtn.addEventListener('click', () => {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
       if (tabs && tabs.length > 0 && tabs[0].id) {
          // *** Send 'exportSelectedPrompt' action message ***
          browser.tabs.sendMessage(tabs[0].id, { action: 'exportSelectedPrompt' }, (response) => {
               if (browser.runtime.lastError) {
                   console.warn("Msg Send Error(Export Selected):", browser.runtime.lastError.message);
                   alert("Could not export selected prompt. Is the ChatGPT tab active and loaded?");
               } else {
                   console.log("Export Selected Resp:", response);
                   if (response && response.status === "Error: No prompt selected") {
                      alert("Please click on a prompt in the sidebar first to select it for export.");
                   } else if (response && response.status.startsWith("Error:")) {
                       alert(`An error occurred during export:\n${response.error || 'Unknown error'}`);
                   }
                   window.close(); // Close popup regardless of response details
               }
          });
       } else { console.error("No active tab found."); }
    });
  });
});
