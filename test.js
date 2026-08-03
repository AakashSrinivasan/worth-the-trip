const assert = require('node:assert/strict');
const { calculateTripWorth } = require('./app.js');

const base = {
  destination: 'Tokyo', purpose: 'leisure', oneWayHours: 11, nights: 5,
  transportCost: 900, nightlyCost: 160, extraCosts: 350,
  totalBudget: 2500, currency: 'USD', ptoDays: 5, timezoneDelta: 8,
  excitement: 9, importance: 3, pace: 'balanced'
};

const result = calculateTripWorth(base);
assert.equal(result.totalCost, 2050);
assert.equal(result.currency, 'USD');
assert.equal(result.valid, true);
assert.ok(result.minimumViableNights > base.nights, 'Long-haul five-night trip should recommend more time');
assert.ok(result.comfortableNights > result.minimumViableNights);
assert.ok(result.usableDays > 0 && result.usableDays < base.nights);
assert.ok(result.score >= 0 && result.score <= 100);
assert.equal(result.breakdown.length, 6);
assert.deepEqual(result.breakdown.map(item => item.key), [
  'travelFriction', 'usableDayRatio', 'costPerDay', 'ptoBurden', 'recovery', 'tripImportance'
]);
assert.ok(result.breakdown.every(item => item.value >= 0 && item.value <= 100));
assert.ok(result.breakdown.every(item => item.explanation && Number.isFinite(item.weight)));
assert.ok(result.flipVariable && result.flipVariable.label && result.flipVariable.action);
assert.ok(result.reasons.length > 0);

const longer = calculateTripWorth({ ...base, nights: result.minimumViableNights });
assert.ok(longer.stayFit >= result.stayFit);
assert.ok(longer.score >= result.score - 5, 'Extending the trip should not materially reduce worth score');

const nearby = calculateTripWorth({
  ...base, destination: 'Nearby town', oneWayHours: 1, nights: 2,
  transportCost: 50, nightlyCost: 100, extraCosts: 25,
  totalBudget: 500, ptoDays: 0, timezoneDelta: 0, excitement: 7
});
assert.ok(nearby.minimumViableNights <= 2);
assert.ok(nearby.score >= 65);

const overBudget = calculateTripWorth({ ...base, totalBudget: 500 });
assert.equal(overBudget.budgetFit, 0);
assert.ok(overBudget.reasons.some(reason => reason.includes('Cut')));
assert.equal(overBudget.flipVariable.key, 'cost');

const event = calculateTripWorth({ ...base, purpose: 'event', importance: 5, nights: 3 });
const leisure = calculateTripWorth({ ...base, purpose: 'leisure', importance: 3, nights: 3 });
assert.ok(event.minimumViableNights <= leisure.minimumViableNights, 'A major event may rationally lower the viable-stay threshold');
assert.ok(event.breakdown.find(item => item.key === 'tripImportance').value > leisure.breakdown.find(item => item.key === 'tripImportance').value);

const hostile = calculateTripWorth({ oneWayHours: 'nan', nights: -30, totalBudget: 0, currency: 'BTC' });
assert.equal(hostile.valid, false);
assert.ok(hostile.validationErrors.length >= 3);
assert.equal(hostile.currency, 'USD');
assert.equal(hostile.score, null);
assert.equal(hostile.breakdown.length, 0);
assert.equal(hostile.verdict, 'Fix inputs to calculate');

const yen = calculateTripWorth({
  ...base, destination: 'International final', purpose: 'event', oneWayHours: 12, nights: 4,
  transportCost: 100000, nightlyCost: 15000, extraCosts: 20000,
  totalBudget: 200000, currency: 'JPY', ptoDays: 3, timezoneDelta: 9,
  excitement: 10, importance: 5, pace: 'packed'
});
assert.equal(yen.valid, true);
assert.equal(yen.totalCost, 180000);

const lowDesire = calculateTripWorth({
  ...base, destination: 'Optional local break', purpose: 'leisure', oneWayHours: 1, nights: 3,
  transportCost: 50, nightlyCost: 40, extraCosts: 30, totalBudget: 1000,
  currency: 'GBP', ptoDays: 1, timezoneDelta: 0, excitement: 3, importance: 1, pace: 'relaxed'
});
assert.ok(lowDesire.score <= 70, `Low desire should restrain the aggregate score, got ${lowDesire.score}`);
assert.notEqual(lowDesire.verdict, 'Strong yes');

const byTravel = [2, 8, 16].map(oneWayHours => calculateTripWorth({ ...base, oneWayHours }).minimumViableNights);
assert.ok(byTravel[0] <= byTravel[1] && byTravel[1] <= byTravel[2], 'More travel cannot reduce the viable stay');
const byRecovery = [0, 6, 12].map(timezoneDelta => calculateTripWorth({ ...base, timezoneDelta }).minimumViableNights);
assert.ok(byRecovery[0] <= byRecovery[1] && byRecovery[1] <= byRecovery[2], 'More recovery burden cannot reduce the viable stay');
const byPace = ['packed', 'balanced', 'relaxed'].map(pace => calculateTripWorth({ ...base, pace }).minimumViableNights);
assert.ok(byPace[0] <= byPace[1] && byPace[1] <= byPace[2], 'A slower pace cannot reduce the viable stay');
assert.ok(result.usableDays <= result.nights);

const fremont = calculateTripWorth({
  tripType: 'outing', destination: 'Fremont', purpose: 'leisure', activity: 'activity',
  oneWayAmount: 20, oneWayUnit: 'minutes', visitHours: 3, logistics: 'normal',
  transportCost: 12, stayOrActivityCost: 45, extraCosts: 10, totalBudget: 100,
  currency: 'USD', excitement: 7, importance: 3, pace: 'balanced'
});
assert.equal(fremont.valid, true);
assert.equal(fremont.stayUnit, 'hours');
assert.equal(fremont.minimumStay, 3);
assert.equal(fremont.comfortableStay, 4.5);
assert.deepEqual(fremont.stayOptions.map(option => option.duration), [2, 3, 4.5, 6]);
assert.equal(fremont.totalCost, 67);
assert.ok(fremont.score >= 80);

const hillsboroughMeal = calculateTripWorth({
  ...fremont, tripType: 'outing', destination: 'Foster City → Hillsborough', purpose: 'visiting',
  activity: 'meal', oneWayAmount: 20, oneWayUnit: 'minutes', visitHours: 1.5,
  logistics: 'easy', transportCost: 8, stayOrActivityCost: 25, extraCosts: 0,
  totalBudget: 60, excitement: 8, importance: 4, pace: 'packed'
});
assert.equal(hillsboroughMeal.minimumStay, 1.5);
assert.ok(hillsboroughMeal.minimumStay < fremont.minimumStay, 'A specific meal should need less destination time than an open activity');

const sanMateoFremont = calculateTripWorth({ ...fremont, destination: 'San Mateo → Fremont' });
assert.equal(sanMateoFremont.minimumStay, 3);
assert.equal(sanMateoFremont.stayOptions.length, 4);

const tiredGroup = calculateTripWorth({ ...sanMateoFremont, energy: 'low', coordination: 'group', logistics: 'heavy' });
assert.ok(tiredGroup.minimumStay > sanMateoFremont.minimumStay, 'Low energy, group coordination, and heavy friction must change the recommendation');

const outingActivities = ['quick', 'meal', 'social', 'activity', 'explore'].map(activity =>
  calculateTripWorth({ ...fremont, activity }).minimumStay
);
assert.ok(outingActivities[0] <= outingActivities[1]);
assert.ok(outingActivities[1] <= outingActivities[2]);
assert.ok(outingActivities[2] <= outingActivities[3]);
assert.ok(outingActivities[3] <= outingActivities[4]);

const localInvalid = calculateTripWorth({ ...fremont, visitHours: 0, oneWayAmount: 20 });
assert.equal(localInvalid.valid, false);
assert.equal(localInvalid.score, null);
assert.equal(localInvalid.stayOptions.length, 0);

console.log(JSON.stringify({ status: 'PASS', scenarios: 15, localSample: {
  score: fremont.score,
  verdict: fremont.verdict,
  minimumStay: fremont.minimumStay,
  comfortableStay: fremont.comfortableStay,
  options: fremont.stayOptions.map(option => `${option.label}: ${option.duration} hours`)
}, sample: {
  score: result.score,
  verdict: result.verdict,
  minimumViableNights: result.minimumViableNights,
  comfortableNights: result.comfortableNights,
  usableDays: Number(result.usableDays.toFixed(1)),
  totalCost: result.totalCost,
  flipVariable: result.flipVariable
}}, null, 2));
