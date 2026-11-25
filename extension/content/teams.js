runActionPulseMeeting({
  joined: "button#hangup-button, button[id*='hangup' i], button[data-tid*='hangup' i], button[data-tid='call-end'], button[aria-label='Leave call' i], button[aria-label='Leave meeting' i]",
  ended: "[data-tid='call-ended'], [data-tid='meeting-ended']",
  captions: "[data-tid='closed-captions-renderer'], [data-tid='closed-caption-v3-window'], [data-tid='closed-caption-window']",
  title: () => document.querySelector(".title-bar, [data-tid='meeting-title'], #callingHeader-title")?.innerText.trim()
    || document.title.replace(/\s*[-–]\s*Microsoft Teams$/i, "").trim(),
  read(container) {
    const speech = container.querySelectorAll("[data-tid='closed-caption-text'], [data-tid='closed-caption-v3-text'], .ui-chat__message__content");
    return [...speech].map((element) => {
      const row = element.closest("[data-tid='closed-caption-v3-item'], .ui-chat__item") || element.parentElement;
      const name = row?.querySelector("[data-tid='closed-caption-speaker'], [data-tid='closed-caption-v3-speaker'], .ui-chat__message__author");
      return { element, speaker: name?.innerText.replace(/:$/, ""), text: element.innerText };
    });
  },
  ignore: (text) => /^(you('ve)? left the (call|meeting)|transcription has (started|stopped))\.?$/i.test(text),
});
