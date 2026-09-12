const STORAGE_KEY = "idark";

async function refreshState() {
  let enabled = true;
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    enabled = (data[STORAGE_KEY] || {}).enabled !== false;
  } catch (e) {
    enabled = true;
  }

  try {
    await browser.action.setBadgeText({ text: enabled ? "" : "OFF" });
    await browser.action.setTitle({
      title: enabled ? "NightRiding: Dark Mode is On" : "NightRiding: Dark Mode is Off"
    });
  } catch (e) {
    /* action API not available yet */
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) refreshState();
});

refreshState();