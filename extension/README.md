# ActionPulse browser extension

The extension captures captions shown in Google Meet, Zoom Web or Microsoft Teams Web. It exports a transcript or uploads it to ActionPulse so an owner, admin or organiser can review suggested tasks.

## Install it

1. Open `chrome://extensions`, `brave://extensions` or `edge://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `extension/` directory. Select the folder containing `manifest.json`.
3. Pin **ActionPulse** from the browser's Extensions menu. If you already loaded it, click **Reload** on its extension card, then refresh any open ActionPulse or meeting tabs.

## Test a live meeting

1. Sign in to ActionPulse and select the workspace in the same browser profile. Leave that tab open.
2. **Open ActionPulse** opens the deployed dashboard by default. To restore that setup after testing locally, use **Connection settings → Use deployed defaults**. For the local preview at `http://localhost:5174` with the production backend, expand **Connection settings** in the extension popup. Set **Backend API URL** to `https://ai-powered-meeting-to-action-converter-9k2z.onrender.com` and **ActionPulse website** to `http://localhost:5174`, then click **Save settings**. For a locally running backend, use `http://localhost:8000`.
3. In **Meetings → New meeting → Live meeting**, paste the link for the call you'll join and save the meeting with its actual start time. Let participants know their captions will be processed.
4. Join the call in the browser and turn on captions using the call controls. There is no separate start button in ActionPulse. Speak a few sentences and pause briefly. The extension should report a growing caption count and show the spoken text under **Transcript preview**.
5. Use **Download VTT** to check the text and speaker names before leaving. The extension normally uploads when the call ends. If it hasn't, choose **Upload captions**. Choose **Review tasks** when suggested tasks are ready, or **Open meeting** to see the saved meeting. Confirm the transcript attached to the original meeting and the suggested tasks quote the right lines.

If the call shows captions but the extension count stays at zero, check that the browser allows the extension to run on that site and reload the call tab. If upload fails, save the VTT and add it to the saved meeting using **Add transcript**.
