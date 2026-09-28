const API_URL = "http://127.0.0.1:8000";
let hoverTimeout;
let activeWord;
const entriesByWord = new WeakMap();

function closeTooltip() {
  clearTimeout(hoverTimeout);
  document.querySelector(".zhsub-tooltip")?.remove();
}

function showTooltip(anchor, entry) {
  closeTooltip();
  const tooltip = document.createElement("aside");
  tooltip.className = "zhsub-tooltip";

  const title = document.createElement("strong");
  title.textContent = entry.simplified;
  const pinyin = document.createElement("div");
  pinyin.className = "zhsub-tooltip__pinyin";
  pinyin.textContent = entry.pinyin;
  const definition = document.createElement("div");
  definition.textContent = entry.definitions.join("; ");
  tooltip.append(title, pinyin, definition);

  const rect = anchor.getBoundingClientRect();
  tooltip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 372))}px`;
  tooltip.style.top = `${Math.max(12, rect.top - 82)}px`;
  document.body.append(tooltip);
}

function sourceElements(container) {
  return [...container.children].filter((element) => !element.classList.contains("zhsub-caption"));
}

function sourceText(container) {
  return sourceElements(container).map((element) => element.innerText || element.textContent).join("").trim();
}

function applyCaption(container, text, tokens) {
  if (sourceText(container) !== text) return;

  container.querySelector(".zhsub-caption")?.remove();
  const caption = document.createElement("span");
  caption.className = "zhsub-caption";
  const styledSource = sourceElements(container)
    .map((element) => element.querySelector("span span") || element.querySelector("span"))
    .find(Boolean);
  if (styledSource) {
    const style = getComputedStyle(styledSource);
    Object.assign(caption.style, {
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      textShadow: style.textShadow,
    });
  }

  for (const token of tokens) {
    if (!token.entry) {
      caption.append(document.createTextNode(token.text));
      continue;
    }

    const word = document.createElement("span");
    word.className = "zhsub-word";
    word.textContent = token.text;
    entriesByWord.set(word, token.entry);
    caption.append(word);
  }

  sourceElements(container).forEach((element) => element.classList.add("zhsub-original"));
  container.append(caption);
  container.dataset.zhsubText = text;
}

async function renderCaption(container) {
  const text = sourceText(container);
  if (!text || container.dataset.zhsubText === text) return;

  try {
    const response = await fetch(`${API_URL}/segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error(`API respondeu ${response.status}`);
    applyCaption(container, text, (await response.json()).tokens);
  } catch (error) {
    // Sem backend, a legenda original permanece visível e o player continua normal.
    console.warn("zhsub: não foi possível segmentar a legenda", error);
  }
}

function renderVisibleCaptions() {
  document.querySelectorAll(".player-timedtext-text-container").forEach(renderCaption);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function createCopyButton() {
  if (document.querySelector(".zhsub-copy-button")) return;

  const button = document.createElement("button");
  button.className = "zhsub-copy-button";
  button.type = "button";
  button.title = "Copiar legenda atual";
  button.setAttribute("aria-label", "Copiar legenda atual");
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const container = document.querySelector(".player-timedtext-text-container");
    const text = container ? sourceText(container) : "";
    if (!text) return;
    await copyToClipboard(text);
    button.classList.add("zhsub-copy-button--copied");
    button.title = "Legenda copiada";
    setTimeout(() => {
      button.classList.remove("zhsub-copy-button--copied");
      button.title = "Copiar legenda atual";
    }, 1200);
  });
  document.body.append(button);
}

function wordAtPoint(x, y) {
  return [...document.querySelectorAll(".zhsub-word")].find((word) => {
    const rect = word.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

// O player pode receber o evento em vez da sobreposição; usamos a posição do cursor.
document.addEventListener("pointermove", (event) => {
  const word = wordAtPoint(event.clientX, event.clientY);
  if (word === activeWord) return;
  activeWord?.classList.remove("zhsub-word--active");
  activeWord = word;
  if (!word) {
    closeTooltip();
    return;
  }
  word.classList.add("zhsub-word--active");
  showTooltip(word, entriesByWord.get(word));
}, true);

let pendingRender;
new MutationObserver(() => {
  clearTimeout(pendingRender);
  pendingRender = setTimeout(renderVisibleCaptions, 50);
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

renderVisibleCaptions();
createCopyButton();
