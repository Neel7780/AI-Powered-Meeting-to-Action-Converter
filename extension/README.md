# ActionPulse browser extension

ActionPulse captures live captions from Google Meet, Zoom Web and Microsoft Teams Web. Workspace owners, admins and organisers can create a meeting from the call and review the suggested tasks afterward.

## Install or update

1. Open `chrome://extensions`, `brave://extensions` or `edge://extensions` in a Chromium browser version 120 or later. Enable **Developer mode**.
2. Select **Load unpacked** and choose this `extension/` folder. For an existing installation, select **Reload** on the extension card and refresh the ActionPulse and meeting tabs.
3. Pin ActionPulse from the Extensions menu to see capture progress and recover uploads.

## Capture a meeting

1. Sign in to ActionPulse in the same browser profile. Leaving the ActionPulse tab open allows the app to refresh your session during a long call.
2. Join the call in the browser. The **Turn this meeting into tasks?** prompt appears after you join. If you dismissed it, choose **Show meeting prompt** from the extension popup while in the call.
3. Select a workspace if you have more than one eligible workspace. Inform the participants that AI will process the call captions, check the confirmation, and choose **Start capture**. The meeting appears in ActionPulse immediately. A matching pending meeting in the chosen workspace is reused when the call link identifies it.
4. Turn on the call’s live captions. Confirm that ActionPulse’s caption count increases while people speak.
5. Leave the call. ActionPulse saves the captions and extracts suggested tasks. Select **Review tasks** from the in-call panel, browser notification or extension popup to review and assign them. If captions were unavailable, use **Add transcript** on the saved meeting. If upload fails, use **Retry upload** or **Download VTT** in the extension.

Captions must be available in the browser call. Native desktop and mobile clients and provider cloud recordings require a separate transcript import. Browser notifications depend on browser and operating system settings. The popup also lists captures that need attention.

## Test against a local backend

The extension defaults to the deployed ActionPulse dashboard and Render backend. Live capture requires the updated backend endpoints. To test them before deploying, run the current backend locally and set **Connection settings** in the extension to a local ActionPulse website such as `http://localhost:5174` and API URL `http://localhost:8000`. Set the frontend’s `VITE_API_BASE_URL` to the same backend and sign in with a workspace owner, admin or organiser account. Select **Use deployed defaults** after the updated backend is deployed.
