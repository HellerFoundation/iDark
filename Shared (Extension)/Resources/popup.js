const STORAGE_KEY = "idark";

const DEFAULTS = {
    enabled: true,
    brightness: 0.88,
    contrast: 1,
    saturation: 1,
    warmth: 0,
    siteEnabled: {}
};

const $ = (id) => document.getElementById(id);

const LOOK_KEYS = ["brightness", "contrast", "saturation", "warmth"];

let state = Object.assign({}, DEFAULTS);
let currentHost = "";

let saveTimer = null;

function save() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    browser.storage.local.set({ [STORAGE_KEY]: state });
}

function saveSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        save();
    }, 150);
}

function formatPercent(value) {
    return Math.round(value * 100) + "%";
}

function render() {
    const siteOn = siteEnabledForHost();
    const active = state.enabled && siteOn;

    $("master-toggle").checked = state.enabled;
    $("site-toggle").checked = siteOn;

    document.body.classList.toggle("adjustments-off", !state.enabled);

    $("brightness").value = state.brightness;
    $("brightness-val").textContent = formatPercent(state.brightness);
    $("contrast").value = state.contrast;
    $("contrast-val").textContent = formatPercent(state.contrast);
    $("saturation").value = state.saturation;
    $("saturation-val").textContent = state.saturation.toFixed(1) + "×";
    $("warmth").value = state.warmth;
    $("warmth-val").textContent = formatPercent(state.warmth);

    $("site-detail").textContent = currentHost
        ? (active ? "Enabled" : "Disabled")
        : "Open a site to manage this";
}

function siteEnabledForHost() {
    if (!currentHost) return true;
    if (Object.prototype.hasOwnProperty.call(state.siteEnabled, currentHost)) {
        return state.siteEnabled[currentHost] !== false;
    }
    return true;
}

function bind() {
    $("master-toggle").addEventListener("change", (e) => {
        state.enabled = e.target.checked;
        save();
        render();
    });

    $("site-toggle").addEventListener("change", (e) => {
        if (!currentHost) {
            render();
            return;
        }
        state.siteEnabled[currentHost] = e.target.checked;
        save();
        render();
    });

    LOOK_KEYS.forEach((key) => {
        $(key).addEventListener("input", (e) => {
            state[key] = parseFloat(e.target.value);
            render();
            saveSoon();
        });
        $(key).addEventListener("change", () => {
            save();
        });
    });

    $("reset-look").addEventListener("click", () => {
        LOOK_KEYS.forEach((key) => {
            state[key] = DEFAULTS[key];
        });
        save();
        render();
    });

    let resetArmed = false;
    let resetTimer = null;

    $("reset-all").addEventListener("click", () => {
        const btn = $("reset-all");
        if (!resetArmed) {
            resetArmed = true;
            btn.textContent = "Tap again to confirm";
            btn.classList.add("danger");
            resetTimer = setTimeout(() => {
                resetArmed = false;
                btn.textContent = "Reset All";
                btn.classList.remove("danger");
            }, 2500);
            return;
        }
        clearTimeout(resetTimer);
        resetArmed = false;
        btn.textContent = "Reset All";
        btn.classList.remove("danger");
        state = Object.assign({}, DEFAULTS, { siteEnabled: {} });
        save();
        render();
    });
}

async function getActiveTab() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs && tabs[0];
        if (tab && tab.url) {
            try {
                currentHost = new URL(tab.url).hostname || "";
            } catch (e) {
                currentHost = "";
            }
        }
    } catch (e) {
        currentHost = "";
    }
    $("site-name").textContent = currentHost || "This site";
}

async function init() {
    try {
        const data = await browser.storage.local.get(STORAGE_KEY);
        state = Object.assign({}, DEFAULTS, data[STORAGE_KEY] || {});
    } catch (e) {
        state = Object.assign({}, DEFAULTS);
    }
    await getActiveTab();
    render();
    bind();
}

init();