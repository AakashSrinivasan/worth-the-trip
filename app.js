(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TripWorth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "heuristic v0.2";
  const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];
  const CURRENCY_LIMIT_SCALE = { USD: 1, EUR: 1, GBP: 1, CAD: 1, AUD: 1, JPY: 200, INR: 100 };
  const PURPOSES = ["leisure", "event", "visiting"];
  const PACES = ["packed", "balanced", "relaxed"];
  const TRIP_TYPES = ["outing", "overnight"];
  const ACTIVITIES = ["quick", "meal", "social", "activity", "explore"];
  const LOGISTICS = ["easy", "normal", "heavy"];
  const ENERGY_LEVELS = ["high", "normal", "low"];
  const COORDINATION_LEVELS = ["solo", "pair", "group"];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const ceilHalf = value => Math.ceil(value * 2) / 2;

  function numeric(raw, key, fallback, min, max, errors, options = {}) {
    const source = raw[key] === undefined || raw[key] === "" ? fallback : raw[key];
    const value = Number(source);
    if (!Number.isFinite(value)) {
      errors.push(`${options.label || key} must be a number.`);
      return fallback;
    }
    if (value < min || value > max) errors.push(`${options.label || key} must be between ${min} and ${max}.`);
    const bounded = clamp(value, min, max);
    return options.integer ? Math.round(bounded) : bounded;
  }

  function invalidResult(input, errors) {
    return {
      ...input, version: VERSION, valid: false, validationErrors: errors,
      minimumViableNights: null, comfortableNights: null, recommendedNights: null,
      minimumStay: null, comfortableStay: null, stayUnit: null, stayOptions: [],
      usableDays: null, usableHours: null, totalCost: null, costPerUsableDay: null,
      costPerUsableHour: null, budgetFit: null, ptoEfficiency: null, recoveryFit: null,
      stayFit: null, breakdown: [], score: null, verdict: "Fix inputs to calculate",
      reasons: [], flipVariable: null,
    };
  }

  function calculateTripWorth(raw = {}) {
    const validationErrors = [];
    const tripType = TRIP_TYPES.includes(raw.tripType) ? raw.tripType : "overnight";
    const currency = CURRENCIES.includes(raw.currency) ? raw.currency : "USD";
    const amountScale = CURRENCY_LIMIT_SCALE[currency];
    if (raw.tripType && !TRIP_TYPES.includes(raw.tripType)) validationErrors.push("Choose a valid trip type.");
    if (raw.currency && !CURRENCIES.includes(raw.currency)) validationErrors.push("Choose a supported currency.");

    let oneWayHours;
    if (raw.oneWayAmount !== undefined) {
      const amount = numeric(raw, "oneWayAmount", tripType === "outing" ? 20 : 4, 0.1, 2160, validationErrors, { label: "One-way travel time" });
      const unit = raw.oneWayUnit === "minutes" ? "minutes" : "hours";
      oneWayHours = unit === "minutes" ? amount / 60 : amount;
      if (oneWayHours < 0.1 || oneWayHours > 36) validationErrors.push("Door-to-door travel time must be between 6 minutes and 36 hours.");
    } else {
      oneWayHours = numeric(raw, "oneWayHours", tripType === "outing" ? 1 / 3 : 4, 0.1, 36, validationErrors, { label: "One-way travel time" });
    }

    const input = {
      destination: String(raw.destination || "Your trip").trim().slice(0, 80) || "Your trip",
      tripType,
      purpose: PURPOSES.includes(raw.purpose) ? raw.purpose : "leisure",
      activity: ACTIVITIES.includes(raw.activity) ? raw.activity : "activity",
      logistics: LOGISTICS.includes(raw.logistics) ? raw.logistics : "normal",
      energy: ENERGY_LEVELS.includes(raw.energy) ? raw.energy : "normal",
      coordination: COORDINATION_LEVELS.includes(raw.coordination) ? raw.coordination : "solo",
      oneWayHours,
      oneWayAmount: Number(raw.oneWayAmount ?? (tripType === "outing" ? Math.round(oneWayHours * 60) : oneWayHours)),
      oneWayUnit: raw.oneWayUnit === "minutes" ? "minutes" : "hours",
      nights: tripType === "overnight" ? numeric(raw, "nights", 3, 1, 60, validationErrors, { label: "Planned nights", integer: true }) : 0,
      visitHours: tripType === "outing" ? numeric(raw, "visitHours", 3, 0.25, 24, validationErrors, { label: "Time at destination" }) : 0,
      transportCost: numeric(raw, "transportCost", 0, 0, 100000 * amountScale, validationErrors, { label: "Transportation cost" }),
      stayOrActivityCost: numeric(raw, raw.stayOrActivityCost !== undefined ? "stayOrActivityCost" : "nightlyCost", 0, 0, 10000 * amountScale, validationErrors, { label: tripType === "outing" ? "Activity / food cost" : "Cost per night" }),
      extraCosts: numeric(raw, "extraCosts", 0, 0, 100000 * amountScale, validationErrors, { label: "Other trip costs" }),
      totalBudget: numeric(raw, "totalBudget", 1000 * amountScale, 1, 250000 * amountScale, validationErrors, { label: "Total trip budget" }),
      currency,
      ptoDays: numeric(raw, "ptoDays", 0, 0, 60, validationErrors, { label: "PTO days" }),
      timezoneDelta: tripType === "overnight" ? numeric(raw, "timezoneDelta", 0, 0, 18, validationErrors, { label: "Time-zone difference" }) : 0,
      excitement: numeric(raw, "excitement", 7, 1, 10, validationErrors, { label: "Excitement" }),
      importance: numeric(raw, "importance", 3, 1, 5, validationErrors, { label: "Trip importance", integer: true }),
      pace: PACES.includes(raw.pace) ? raw.pace : "balanced",
    };
    if (raw.purpose && !PURPOSES.includes(raw.purpose)) validationErrors.push("Choose a valid trip purpose.");
    if (raw.pace && !PACES.includes(raw.pace)) validationErrors.push("Choose a valid travel pace.");
    if (raw.activity && !ACTIVITIES.includes(raw.activity)) validationErrors.push("Choose a valid outing activity.");
    if (raw.logistics && !LOGISTICS.includes(raw.logistics)) validationErrors.push("Choose a valid logistics level.");
    if (raw.energy && !ENERGY_LEVELS.includes(raw.energy)) validationErrors.push("Choose a valid energy level.");
    if (raw.coordination && !COORDINATION_LEVELS.includes(raw.coordination)) validationErrors.push("Choose a valid coordination level.");
    if (validationErrors.length) return invalidResult(input, validationErrors);

    return tripType === "outing" ? calculateOuting(input) : calculateOvernight(input);
  }

  function motivation(input) {
    const importanceMultiplier = 1.15 - 0.06 * input.importance;
    const excitementMultiplier = 1.12 - 0.024 * input.excitement;
    const purposeMultiplier = { leisure: 1, event: 0.85, visiting: 0.92 }[input.purpose];
    return clamp(importanceMultiplier * excitementMultiplier * purposeMultiplier, 0.72, 1.2);
  }

  function calculateOuting(input) {
    const roundTripHours = input.oneWayHours * 2;
    const activityFloor = { quick: 0.5, meal: 1.25, social: 2, activity: 2, explore: 3 }[input.activity];
    const payoffRatio = { quick: 0.75, meal: 1.4, social: 2, activity: 2.4, explore: 3 }[input.activity];
    const logisticsHours = { easy: 0.2, normal: 0.6, heavy: 1.25 }[input.logistics]
      + { solo: 0, pair: 0.2, group: 0.65 }[input.coordination];
    const paceMultiplier = { packed: 0.85, balanced: 1, relaxed: 1.2 }[input.pace];
    const energyMultiplier = { high: 0.88, normal: 1, low: 1.18 }[input.energy];
    const minimumStay = clamp(ceilHalf(Math.max(activityFloor, (roundTripHours + logisticsHours) * payoffRatio * motivation(input) * paceMultiplier * energyMultiplier)), 0.5, 12);
    const comfortBuffer = { quick: 0.5, meal: 0.75, social: 1.5, activity: 1.5, explore: 2 }[input.activity]
      + (input.logistics === "heavy" ? 0.5 : 0) + (input.energy === "low" ? 0.5 : 0);
    const comfortableStay = clamp(ceilHalf(minimumStay + comfortBuffer), 1, 16);
    const dayOfIt = clamp(ceilHalf(Math.max(6, comfortableStay + 1.5)), 2, 18);
    const actualStay = input.visitHours;
    const totalCost = input.transportCost + input.stayOrActivityCost + input.extraCosts;
    const costPerUsableHour = totalCost / actualStay;
    const budgetFit = totalCost <= input.totalBudget ? 100 : clamp(100 - ((totalCost - input.totalBudget) / input.totalBudget) * 100, 0, 100);
    const travelEfficiency = clamp((actualStay / (actualStay + roundTripHours + logisticsHours)) * 100, 0, 100);
    const timePayoff = clamp((actualStay / minimumStay) * 100, 0, 100);
    const scheduleFit = clamp(100 - Math.max(0, actualStay + roundTripHours + logisticsHours - 10) * 12, 0, 100);
    const convenience = clamp({ easy: 95, normal: 75, heavy: 50 }[input.logistics] - { solo: 0, pair: 6, group: 16 }[input.coordination], 0, 100);
    const costFit = totalCost === 0 ? 100 : clamp((input.totalBudget / Math.max(totalCost, 1)) * 100, 0, 100);
    const purposeBonus = { leisure: 0, event: 8, visiting: 4 }[input.purpose];
    const tripImportance = clamp(input.excitement * 7 + input.importance * 6 + purposeBonus, 0, 100);
    const breakdown = [
      { key: "travelEfficiency", label: "Travel-to-fun ratio", value: travelEfficiency, weight: 0.22, explanation: `${roundTripHours.toFixed(1)} hours round trip for ${actualStay.toFixed(1)} hours there.` },
      { key: "timePayoff", label: "Time payoff", value: timePayoff, weight: 0.20, explanation: `${actualStay.toFixed(1)} planned hours versus ${minimumStay.toFixed(1)} hours for a worthwhile outing.` },
      { key: "costFit", label: "Cost fit", value: costFit, weight: 0.18, explanation: `${totalCost.toFixed(0)} ${input.currency} total against a ${input.totalBudget.toFixed(0)} ${input.currency} limit.` },
      { key: "convenience", label: "Friction + coordination", value: convenience, weight: 0.14, explanation: `${input.logistics} travel friction with ${input.coordination} coordination.` },
      { key: "scheduleFit", label: "Day fit + energy", value: scheduleFit, weight: 0.11, explanation: `${input.energy} energy; the full outing consumes about ${(actualStay + roundTripHours + logisticsHours).toFixed(1)} hours.` },
      { key: "tripImportance", label: "Personal pull", value: tripImportance, weight: 0.15, explanation: `Importance ${input.importance}/5 and excitement ${input.excitement}/10.` },
    ];
    const stayFit = clamp(actualStay / minimumStay, 0, 1);
    const weighted = breakdown.reduce((sum, item) => sum + item.value * item.weight, 0);
    const score = Math.round(clamp(weighted * (0.68 + 0.32 * stayFit), 0, 100));
    let verdict = score >= 80 && actualStay >= minimumStay ? "Easy yes" : score >= 65 ? "Worth the drive" : score >= 50 ? "Borderline — tune it" : "Too much friction for now";
    if (input.purpose === "event" && input.importance === 5 && score >= 45) verdict = "Worth it for the occasion";
    const reasons = [];
    if (actualStay < minimumStay) reasons.push(`Stay ${ceilHalf(minimumStay - actualStay)} more hour${minimumStay - actualStay <= 1 ? "" : "s"} to make the travel feel proportionate.`);
    if (totalCost > input.totalBudget) reasons.push(`Cut about ${Math.ceil(totalCost - input.totalBudget).toLocaleString()} ${input.currency} to fit your limit.`);
    if (input.logistics === "heavy") reasons.push("Parking, reservations, prep, or group coordination materially increase the outing burden.");
    if (!reasons.length) reasons.push("Your destination time comfortably pays back the travel and logistics burden.");
    let flipVariable;
    if (totalCost > input.totalBudget) flipVariable = { key: "cost", label: "Total cost", action: `Cut ${Math.ceil(totalCost - input.totalBudget).toLocaleString()} ${input.currency}.` };
    else if (actualStay < minimumStay) flipVariable = { key: "hours", label: "Time there", action: `Increase the visit from ${actualStay} to ${minimumStay} hours.` };
    else if (input.logistics === "heavy") flipVariable = { key: "logistics", label: "Logistics", action: "Pre-book parking/reservations or shrink the group coordination burden." };
    else flipVariable = { key: "time", label: "Time there", action: `The outing already works; ${comfortableStay} hours makes it feel unhurried.` };
    return {
      ...input, version: VERSION, valid: true, validationErrors: [], roundTripHours,
      minimumStay, comfortableStay, stayUnit: "hours",
      stayOptions: [
        { key: "quick", label: "Quick", duration: Math.max(activityFloor, ceilHalf(minimumStay * 0.65)), note: "Only for a specific mission." },
        { key: "worthwhile", label: "Worthwhile", duration: minimumStay, note: "Best travel-to-experience trade-off." },
        { key: "comfortable", label: "Comfortable", duration: comfortableStay, note: "Adds breathing room." },
        { key: "day", label: "Make a day of it", duration: dayOfIt, note: "Adds food or a second stop." },
      ],
      minimumViableNights: null, comfortableNights: null, recommendedNights: null,
      usableDays: null, usableHours: actualStay, totalCost, costPerUsableDay: null, costPerUsableHour,
      budgetFit, ptoEfficiency: 100, recoveryFit: 100, stayFit, breakdown, score, verdict, reasons, flipVariable,
    };
  }

  function calculateOvernight(input) {
    const roundTripHours = input.oneWayHours * 2;
    const coordinationHours = { solo: 0, pair: 0.5, group: 1.5 }[input.coordination];
    const frictionHours = { easy: 0, normal: 1, heavy: 3 }[input.logistics];
    const effectiveTravelHours = roundTripHours + coordinationHours + frictionHours;
    const paceRatio = { packed: 3, balanced: 4, relaxed: 5 }[input.pace];
    const energyMultiplier = { high: 0.9, normal: 1, low: 1.15 }[input.energy];
    const recoveryDays = Math.max(0, input.timezoneDelta - 2) * 0.2;
    const minimumViableNights = clamp(Math.ceil((effectiveTravelHours * paceRatio * motivation(input) * energyMultiplier) / 12 + recoveryDays), 1, 60);
    const comfortBuffer = Math.max(1, Math.ceil(recoveryDays + (input.pace === "relaxed" ? 1 : 0) + (input.energy === "low" ? 0.5 : 0)));
    const comfortableNights = clamp(minimumViableNights + comfortBuffer, 2, 60);
    const arrivalDepartureLoss = Math.min(input.nights * 0.75, roundTripHours / 12);
    const jetLagLoss = Math.min(input.nights * 0.4, recoveryDays);
    const usableDays = Math.max(0.5, input.nights - arrivalDepartureLoss - jetLagLoss);
    const usableHours = usableDays * 12;
    const totalCost = input.transportCost + input.stayOrActivityCost * input.nights + input.extraCosts;
    const costPerUsableDay = totalCost / usableDays;
    const travelFriction = clamp((usableHours / (usableHours + roundTripHours)) * 100, 0, 100);
    const usableDayRatio = clamp((usableDays / input.nights) * 100, 0, 100);
    const budgetPerPlannedDay = input.totalBudget / input.nights;
    const costPerDayFit = costPerUsableDay === 0 ? 100 : clamp((budgetPerPlannedDay / costPerUsableDay) * 100, 0, 100);
    const ptoEfficiency = input.ptoDays === 0 ? 100 : clamp((usableDays / input.ptoDays) * 100, 0, 100);
    const recoveryFit = clamp(100 - jetLagLoss * 18, 0, 100);
    const purposeBonus = { leisure: 0, event: 8, visiting: 4 }[input.purpose];
    const tripImportance = clamp(input.excitement * 7 + input.importance * 6 + purposeBonus, 0, 100);
    const budgetFit = totalCost <= input.totalBudget ? 100 : clamp(100 - ((totalCost - input.totalBudget) / input.totalBudget) * 100, 0, 100);
    const stayFit = clamp(input.nights / minimumViableNights, 0, 1);
    const breakdown = [
      { key: "travelFriction", label: "Travel friction", value: travelFriction, weight: 0.20, explanation: `${roundTripHours.toFixed(1)} hours round trip, ${input.logistics} friction, ${input.coordination} coordination.` },
      { key: "usableDayRatio", label: "Usable-day ratio", value: usableDayRatio, weight: 0.15, explanation: `${usableDayRatio.toFixed(0)}% remains usable after transit and recovery.` },
      { key: "costPerDay", label: "Cost per usable day", value: costPerDayFit, weight: 0.20, explanation: `${costPerUsableDay.toFixed(0)} ${input.currency} per usable day.` },
      { key: "ptoBurden", label: "PTO burden", value: ptoEfficiency, weight: 0.15, explanation: input.ptoDays === 0 ? "No PTO required." : `${input.ptoDays} PTO days for ${usableDays.toFixed(1)} usable days.` },
      { key: "recovery", label: "Recovery + energy", value: recoveryFit, weight: 0.15, explanation: `${input.timezoneDelta} hours of time-zone change with ${input.energy} energy.` },
      { key: "tripImportance", label: "Personal pull", value: tripImportance, weight: 0.15, explanation: `Importance ${input.importance}/5 and excitement ${input.excitement}/10.` },
    ];
    const weightedScore = breakdown.reduce((sum, item) => sum + item.value * item.weight, 0);
    const desireGate = 0.65 + 0.35 * (tripImportance / 100);
    const score = Math.round(clamp(weightedScore * (0.65 + 0.35 * stayFit) * desireGate, 0, 100));
    let verdict = score >= 80 && input.nights >= minimumViableNights ? "Strong yes" : score >= 65 ? "Probably worth it" : score >= 50 ? "Borderline — adjust the trip" : "Probably not worth it yet";
    if (input.purpose === "event" && input.importance === 5 && score >= 45) verdict = "Worth it for the occasion";
    const reasons = [];
    if (input.nights < minimumViableNights) reasons.push(`Add ${minimumViableNights - input.nights} night${minimumViableNights - input.nights === 1 ? "" : "s"} to amortize the travel.`);
    if (totalCost > input.totalBudget) reasons.push(`Cut about ${Math.ceil(totalCost - input.totalBudget).toLocaleString()} ${input.currency} to fit your budget.`);
    if (input.timezoneDelta >= 6) reasons.push("The time-zone change materially reduces the first usable days.");
    if (!reasons.length) reasons.push("The stay reasonably covers time, cost, PTO, and recovery.");
    let flipVariable;
    if (totalCost > input.totalBudget) flipVariable = { key: "cost", label: "Total cost", action: `Cut ${Math.ceil(totalCost - input.totalBudget).toLocaleString()} ${input.currency}.` };
    else if (input.nights < minimumViableNights) flipVariable = { key: "nights", label: "Stay length", action: `Add ${minimumViableNights - input.nights} night${minimumViableNights - input.nights === 1 ? "" : "s"}.` };
    else flipVariable = { key: "nights", label: "Stay length", action: `${comfortableNights} nights makes the trip feel unhurried.` };
    return {
      ...input, version: VERSION, valid: true, validationErrors: [], roundTripHours, recoveryDays,
      minimumStay: minimumViableNights, comfortableStay: comfortableNights, stayUnit: "nights",
      stayOptions: [
        { key: "quick", label: "Quick", duration: Math.max(1, minimumViableNights - 1), note: "Compressed and purpose-driven." },
        { key: "minimum", label: "Worthwhile", duration: minimumViableNights, note: "Pays back the travel." },
        { key: "comfortable", label: "Comfortable", duration: comfortableNights, note: "Recovery plus breathing room." },
        { key: "slow", label: "Make a trip of it", duration: clamp(comfortableNights + 2, 3, 60), note: "Room for a side trip." },
      ],
      minimumViableNights, comfortableNights, recommendedNights: minimumViableNights,
      usableDays, usableHours, totalCost, costPerUsableDay, costPerUsableHour: totalCost / usableHours,
      budgetFit, ptoEfficiency, recoveryFit, stayFit, breakdown, score, verdict, reasons, flipVariable,
    };
  }

  return { calculateTripWorth, VERSION, CURRENCIES };
});
