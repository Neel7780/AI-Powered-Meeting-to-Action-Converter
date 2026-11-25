runActionPulseMeeting({
  joined: ".leave-button, .footer-button__button[aria-label*='Leave' i], .footer-button__button[aria-label*='End' i], button[aria-label='Leave Meeting' i], button[aria-label='End Meeting' i]",
  ended: "[data-testid='meeting-ended'], .meeting-ended",
  captions: ".closed-caption-window, .caption-container, #closed-caption-item, [data-testid='closed-caption-window']",
  title: () => document.querySelector(".meeting-info-title, .title-content, [data-testid='meeting-title']")?.innerText.trim()
    || document.title.replace(/\s*[-–]\s*Zoom$/i, "").trim(),
  read(container) {
    const rows = [...container.querySelectorAll(".closed-caption-text, .caption-text, #closed-caption-item, .cc-content")];
    return (rows.length ? rows.filter((row) => !rows.some((other) => row !== other && row.contains(other))) : [container]).map((element) => {
      const speakerNode = element.parentElement?.querySelector(".closed-caption-speaker, .speaker-name, .cc-speaker");
      const text = element.innerText.trim();
      const labeled = speakerNode ? null : text.match(/^([^:\n]{1,60}):\s+([\s\S]+)$/);
      return { element, speaker: speakerNode?.innerText.replace(/:$/, "") || labeled?.[1], text: labeled?.[2] || text };
    });
  },
  ignore: (text) => /^(live transcript is enabled|the host has disabled captions|closed captioning (has )?(started|stopped))\.?$/i.test(text),
});
