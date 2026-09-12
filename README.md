# NightRiding

**NightRiding** is a Safari Web Extension (with a companion iOS and macOS app shell) that applies a comfortable dark mode to *every* website — even ones that don't support dark mode themselves. Instead of using heavy CSS filters that blur images and drain battery, NightRiding intelligently rewrites the colors of each page: light backgrounds become dark, light text becomes light, and borders are blended to match, while images, videos, and embedded content are left untouched.

## Features

- **Global dark mode** — one master toggle for all sites.
- **Per-site control** — turn dark mode on or off for the site you're on, without affecting other sites.
- **Fine-tuned look** — adjust brightness, contrast, saturation, and warmth with live sliders.
- **Reset Look** — restore the color sliders to their defaults at any time.
- **Reset All** — restore everything to factory defaults (sliders, master toggle, and all per-site overrides). Requires a second tap to confirm.
- **Flash guard** — prevents a white flash when a page loads before darkening is applied.
- **Live updates** — content added dynamically by the page (infinite scroll, modals, etc.) is darkened automatically.

## How It Works

The extension injects a small content script into web pages. The script reads each element's computed colors, converts light colors to a dark palette derived from your slider settings, and applies them as inline styles. Your original page is never modified on disk — toggling NightRiding off (or tapping **Reset Look**/**Reset All**) restores the page's original appearance instantly.

All settings are stored locally on your device using the extension's storage API and are synced to every open tab automatically.

## Permissions Explained

| Permission | Why it's needed |
|---|---|
| `storage` | Saves your settings (toggle state, sliders, per-site overrides) locally on your device. Nothing is sent to a server. |
| `activeTab` / website access | Lets the popup know which site you're visiting (for per-site toggling) and lets the content script darken the pages you browse. |

**Website access on iOS:** After installing, iOS requires you to explicitly enable the extension and grant it permission to run on websites. You can grant access per-site or to **All Websites**:

1. Open the **NightRiding** app and follow the prompt, **or** go to **Settings → Safari → Extensions → NightRiding**.
2. Turn on the extension.
3. Under *Permissions*, choose **All Websites** (or *Ask* to approve sites individually).

**On macOS:** Enable it in **Safari → Settings → Extensions**, then allow website access in the NightRiding entry.

## Privacy

NightRiding has **no network access, no analytics, and collects no data**. All processing happens on-device. For App Store purposes it qualifies for the *“Data Not Collected”* privacy label.

## Requirements

- **iOS 16.4+** or **macOS 13.3+** (Safari 16.4+ for full Manifest V3 web extension support).
- Xcode 14+ to build from source.

## Building & Installing (Development)

1. Open `NightRiding.xcodeproj` in Xcode.
2. Set your signing team for both the app and extension targets (the extension's bundle ID must be the app's ID plus `.Extension`).
3. Run the **NightRiding** target on your device or Mac.

4. Launch NightRiding once, then enable the extension as described above.
## App Store Notes

- The extension is embedded in the app; publishing the app publishes the extension — there is no separate listing.
- App Review will test the **enable-in-Settings flow**, so the onboarding screen in the app (which links users to Safari Settings) matters.
- Because NightRiding requests broad website access, mention in your review notes that the extension only reads page colors to restyle them locally and stores nothing off-device.

## Project Layout

```
iDark/
├── Shared (App)/          Cross-platform onboarding UI (Swift + local HTML)
├── Shared (Extension)/    The Safari Web Extension (content.js, popup, manifest)
├── iOS (App)/             iOS-specific app glue
├── iOS (Extension)/       iOS extension plist
├── macOS (App)/           macOS-specific app glue
└── macOS (Extension)/     macOS extension plist
```
