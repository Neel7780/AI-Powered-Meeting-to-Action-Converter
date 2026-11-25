runActionPulseMeeting({
  joined: "button[jsname='CQylAd'], button[data-tooltip*='Leave call' i], button[aria-label*='Leave call' i]",
  ended: "[data-call-ended], [jsname='r8qRAd']",
  captions: "div[jsname='r4nke'], .a4bvKc, div[jscontroller='D1tHje']",
  title: () => document.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title")
    || document.title.replace(/\s*[-–]\s*Google Meet$/i, "").trim(),
  read(container) {
    const primary = [...container.querySelectorAll(".nM7Ebe")];
    const blocks = primary.length ? primary : [...container.querySelectorAll(".T4LgNb, .VbkSUe")];
    return blocks.filter((block) => !blocks.some((other) => block !== other && block.contains(other))).flatMap((element) => {
      if (element.closest("button, [role='button'], [role='toolbar'], [role='menu']")) return [];
      const name = element.querySelector(".zs7PeP, .jxFHg, .NWbcqb, [data-sender-name]");
      const speech = element.querySelector(".iTTPOb, .bh44bd, .yg30fd");
      if (speech) return [{ element, speaker: name?.getAttribute("data-sender-name") || name?.innerText, text: speech.innerText }];
      const [first, ...rest] = element.innerText.trim().split("\n");
      return [{ element, speaker: name?.innerText || (rest.length ? first : ""), text: rest.length ? rest.join(" ") : first }];
    });
  },
  ignore: (text) => /^(live captions (are on|have been turned off)|jump to latest|returning to home screen|you left the meeting|turn on captions|caption settings|format_size)$/i.test(text),
});
