(() => {
  "use strict";

  const form = document.querySelector("#trip-form");
  const q = selector => document.querySelector(selector);
  const qa = selector => [...document.querySelectorAll(selector)];
  const TRAVEL_STOPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1080, 1440, 1800, 2160];
  const MAPPED = {
    logistics: {
      values: value => value <= 3 ? "easy" : value <= 7 ? "normal" : "heavy",
      slider: { easy: 2, normal: 5, heavy: 9 },
      labels: { easy: "Easy", normal: "Normal", heavy: "A pain" },
    },
    coordination: {
      values: value => value <= 3 ? "solo" : value <= 6 ? "pair" : "group",
      slider: { solo: 1, pair: 5, group: 9 },
      labels: { solo: "Just me", pair: "Two people", group: "Whole group" },
    },
    energy: {
      values: value => value <= 3 ? "low" : value <= 7 ? "normal" : "high",
      slider: { low: 2, normal: 5, high: 9 },
      labels: { low: "Low", normal: "Normal", high: "Full tank" },
    },
    pace: {
      values: value => value <= 3 ? "packed" : value <= 7 ? "balanced" : "relaxed",
      slider: { packed: 2, balanced: 5, relaxed: 9 },
      labels: { packed: "Packed", balanced: "Balanced", relaxed: "Slow" },
    },
  };

  function setText(selector, text) {
    const node = q(selector);
    if (node) node.textContent = text;
  }

  function formatMinutes(minutes) {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
  }

  function formatDuration(value, unit) {
    const number = Number(value);
    const clean = Number.isInteger(number) ? number : number.toFixed(1);
    const singular = number === 1 ? unit.replace(/s$/, "") : unit;
    return `${clean} ${singular}`;
  }

  function currentTravelMinutes() {
    const amount = Number(q("#oneWayAmount").value);
    return q("#oneWayUnit").value === "minutes" ? amount : amount * 60;
  }

  function nearestTravelIndex(minutes) {
    return TRAVEL_STOPS.reduce((best, value, index) =>
      Math.abs(value - minutes) < Math.abs(TRAVEL_STOPS[best] - minutes) ? index : best, 0);
  }

  function syncTravelFromRange() {
    const minutes = TRAVEL_STOPS[Number(q("#travelTimeRange").value)];
    if (minutes < 60) {
      q("#oneWayAmount").value = minutes;
      q("#oneWayUnit").value = "minutes";
    } else {
      q("#oneWayAmount").value = minutes / 60;
      q("#oneWayUnit").value = "hours";
    }
  }

  function syncRangeFromTravel() {
    q("#travelTimeRange").value = nearestTravelIndex(currentTravelMinutes());
  }

  function syncStayRanges(source) {
    if (source !== "visitRange") q("#visitHoursRange").value = Math.min(16, Math.max(.5, Number(q("#visitHours").value) || 3));
    if (source !== "visitExact") q("#visitHours").value = q("#visitHoursRange").value;
    if (source !== "nightsRange") q("#nightsRange").value = Math.min(30, Math.max(1, Number(q("#nights").value) || 5));
    if (source !== "nightsExact") q("#nights").value = q("#nightsRange").value;
  }

  function syncMappedFromSlider(slider) {
    const target = slider.dataset.target;
    const config = MAPPED[target];
    const value = config.values(Number(slider.value));
    q(`#${target}`).value = value;
    setText(`#${target}-output`, config.labels[value]);
  }

  function syncMappedFromEngine() {
    Object.entries(MAPPED).forEach(([target, config]) => {
      const value = q(`#${target}`).value;
      q(`#${target}Slider`).value = config.slider[value];
      setText(`#${target}-output`, config.labels[value]);
    });
  }

  function updateControlLabels() {
    const travelText = formatMinutes(currentTravelMinutes());
    setText("#travel-time-output", travelText);
    q("#travelTimeRange").setAttribute("aria-valuetext", travelText);
    setText("#visit-output", formatDuration(q("#visitHours").value, "hours"));
    setText("#nights-output", formatDuration(q("#nights").value, "nights"));
    setText("#excitement-output", `${q("#excitement").value}/10`);
    setText("#importance-output", `${q("#importance").value}/5`);
  }

  function setNamedValue(name, value) {
    const fields = form.elements[name];
    if (!fields) return;
    if (fields instanceof RadioNodeList) {
      const match = [...fields].find(field => field.value === value);
      if (match) match.checked = true;
      return;
    }
    fields.value = value;
  }

  function hydrate() {
    const params = new URLSearchParams(location.search);
    const names = [...new Set([...form.elements].filter(element => element.name).map(element => element.name))];
    names.forEach(name => { if (params.has(name)) setNamedValue(name, params.get(name)); });
    syncRangeFromTravel();
    syncStayRanges("hydrate");
    syncMappedFromEngine();
  }

  function updateMode(type) {
    qa(".outing-only").forEach(element => element.hidden = type !== "outing");
    qa(".overnight-only").forEach(element => element.hidden = type !== "overnight");
    q("#visitHours").disabled = type !== "outing";
    qa('[name="activity"]').forEach(element => element.disabled = type !== "outing");
    q("#nights").disabled = type !== "overnight";
    q("#ptoDays").disabled = type !== "overnight";
    q("#timezoneDelta").disabled = type !== "overnight";
    setText("#stay-cost-label", type === "outing" ? "Food / activity" : "Cost per night");
  }

  function rawValues() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function updateUrl(raw) {
    const params = new URLSearchParams();
    params.set("v", "0.4");
    Object.entries(raw).forEach(([key, value]) => params.set(key, value));
    history.replaceState(null, "", `${location.pathname}?${params}`);
  }

  function verdictLead(result) {
    if (result.score >= 76) return "Go.";
    if (result.score >= 58) return "Probably go.";
    return "Maybe skip it.";
  }

  function renderFactors(result) {
    q("#breakdown").replaceChildren(...result.breakdown.map(item => {
      const row = document.createElement("div");
      row.className = "factor-row";
      row.title = `${item.explanation} Weight: ${Math.round(item.weight * 100)}%.`;
      const label = document.createElement("span");
      label.textContent = item.label.toUpperCase();
      const track = document.createElement("div");
      track.className = "factor-track";
      const fill = document.createElement("i");
      fill.style.width = `${Math.round(item.value)}%`;
      track.append(fill);
      const value = document.createElement("b");
      value.textContent = Math.round(item.value);
      row.append(label, track, value);
      return row;
    }));
  }

  function renderStayOptions(result) {
    const friendly = ["Quick", "Worth it", "Comfortable", result.tripType === "outing" ? "Full day" : "Longer"];
    const descriptions = result.tripType === "outing"
      ? ["One clear reason", "Best trade-off", "No rushing", "Add another stop"]
      : ["Compressed", "Best trade-off", "Room to recover", "Add a side trip"];

    q("#stay-options").replaceChildren(...result.stayOptions.map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `stay-option ${index === 1 ? "featured" : ""}`;
      button.innerHTML = `<span>${friendly[index]}</span><strong>${formatDuration(option.duration, result.stayUnit)}</strong><small>${descriptions[index]}</small>`;
      button.addEventListener("click", () => {
        if (result.tripType === "outing") {
          q("#visitHours").value = option.duration;
          syncStayRanges("visitExact");
        } else {
          q("#nights").value = option.duration;
          syncStayRanges("nightsExact");
        }
        render();
      });
      return button;
    }));
  }

  function render() {
    const raw = rawValues();
    updateMode(raw.tripType);
    updateControlLabels();
    const result = TripWorth.calculateTripWorth(raw);
    const errors = q("#validation-errors");
    errors.hidden = result.valid;
    errors.textContent = result.valid ? "" : `Check these: ${result.validationErrors.join(" ")}`;

    if (!result.valid) {
      q("#result-summary").innerHTML = "Fix the numbers <br><em>to continue.</em>";
      setText("#result-copy", "The recommendation will update automatically.");
      q("#stay-options").replaceChildren();
      q("#breakdown").replaceChildren();
      q("#share-result").disabled = true;
      return;
    }

    q("#share-result").disabled = false;
    updateUrl(raw);
    const recommended = result.stayOptions[1];
    const recommendedText = formatDuration(recommended.duration, result.stayUnit);
    const oneWayText = formatMinutes(Math.round(result.oneWayHours * 60));
    const roundTripText = formatMinutes(Math.round(result.roundTripHours * 60));
    const destination = result.destination === "Your trip" ? "YOUR TRIP" : result.destination.toUpperCase();

    setText("#destination-label", destination);
    q("#result-summary").innerHTML = `${verdictLead(result)} Stay at least <em>${recommendedText}.</em>`;
    setText("#result-copy", result.tripType === "outing"
      ? `${roundTripText} in transit needs enough time on the other side. This is the shortest stay that makes the ratio feel fair.`
      : `${roundTripText} in transit, plus recovery, makes ${recommendedText} the shortest stay that should feel like a real trip.`);
    setText("#round-trip-label", `${roundTripText.toUpperCase()} TRAVEL`);
    setText("#destination-time-label", `${recommendedText.toUpperCase()} THERE`);
    q("#route-progress").style.width = `${Math.max(12, Math.min(88, Math.round(result.score)))}%`;
    setText("#method-score", result.score);
    setText("#method-version", result.version.replace("heuristic ", "").toUpperCase());
    setText("#method-copy", result.tripType === "outing"
      ? "Weighted from travel-to-time payoff, purpose, hassle, coordination, energy and cost. Hover a signal for the exact input behind it."
      : "Weighted from travel friction, usable days, recovery, PTO, personal pull and cost. Hover a signal for the exact input behind it.");

    renderStayOptions(result);
    renderFactors(result);
  }

  hydrate();
  updateMode(rawValues().tripType);

  q("#travelTimeRange").addEventListener("input", () => { syncTravelFromRange(); render(); });
  q("#oneWayAmount").addEventListener("input", () => { syncRangeFromTravel(); render(); });
  q("#oneWayUnit").addEventListener("input", () => { syncRangeFromTravel(); render(); });
  q("#visitHoursRange").addEventListener("input", () => { syncStayRanges("visitRange"); render(); });
  q("#visitHours").addEventListener("input", () => { syncStayRanges("visitExact"); render(); });
  q("#nightsRange").addEventListener("input", () => { syncStayRanges("nightsRange"); render(); });
  q("#nights").addEventListener("input", () => { syncStayRanges("nightsExact"); render(); });
  qa(".mapped-range").forEach(slider => slider.addEventListener("input", () => { syncMappedFromSlider(slider); render(); }));

  form.addEventListener("input", event => {
    if (["travelTimeRange", "oneWayAmount", "oneWayUnit", "visitHoursRange", "visitHours", "nightsRange", "nights"].includes(event.target.id)) return;
    if (event.target.classList.contains("mapped-range")) return;
    render();
  });
  form.addEventListener("submit", event => event.preventDefault());
  q("#share-result").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setText("#share-status", "Copied.");
    } catch (_) {
      setText("#share-status", "Link is in the address bar.");
    }
  });

  render();
})();
