// options.js – handles sidebar width preference

const STORAGE_KEY = 'sidebarWidth';
const slider = document.getElementById('widthRange');
const valueEl = document.getElementById('widthValue');

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  const w = typeof data[STORAGE_KEY] === 'number' ? data[STORAGE_KEY] : 250;
  slider.value = w;
  valueEl.textContent = w;
});

slider.addEventListener('input', () => {
  const w = Number(slider.value);
  valueEl.textContent = w;
  chrome.storage.sync.set({ [STORAGE_KEY]: w });
});
