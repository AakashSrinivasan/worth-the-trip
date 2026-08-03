# Worth The Trip? MVP

A static, no-backend calculator for both **local outings/day trips** and **overnight travel**. Heuristic v0.2 returns four scenario-sensitive play modes—Quick, Worthwhile, Comfortable, and Make a Day/Trip of It—rather than applying one fixed travel-time multiplier.

## Inputs that change the recommendation

- trip type, purpose, and activity type;
- door-to-door travel time and travel friction;
- energy, coordination burden, pace, excitement, and importance;
- planned destination time or nights;
- transportation, activity/lodging, other costs, budget, PTO, and time-zone change where relevant.

For outings, the model works in hours and treats an errand, meal, social visit, attraction, and open-ended exploration differently. For overnight travel, it works in nights and adds PTO and recovery burden. Both expose the factor weights and the best variable to change.

## Run and verify

```bash
python3 -m http.server 8080
node test.js
python3 browser_test.py  # Chrome remote debugging on port 9223
```

Receipts and previews:

- `browser-receipt.json`
- `desktop-preview.png`
- `mobile-preview.png`

Regression coverage includes San Mateo → Fremont, Foster City → Hillsborough, local activity differences, energy/coordination/friction sensitivity, long-haul travel, hostile inputs, desktop interaction, and mobile layout.

## Revenue mechanics

1. **Contextual affiliate commissions:** the result links to bookable hotels, activities, restaurants, parking, eSIMs, rental cars, or insurance. A partner or affiliate network tracks the click and pays a percentage or fixed bounty after a qualifying purchase.
2. **Qualified local leads:** a restaurant, tour, event, or activity operator pays per referred booking lead or completed reservation.
3. **Sponsored placement:** a business pays a fixed campaign or monthly fee for clearly labeled visibility near relevant results; sponsorship must not alter the score.
4. **Licensing / embeds:** travel publishers, hotel groups, tourism sites, or itinerary products pay monthly or by usage to embed a branded calculator.
5. **Display advertising:** an ad network pays per thousand impressions and sometimes clicks. This is a later traffic model, not the first-dollar plan.

Best initial route: free result → contextual action link. Short outings naturally connect to restaurants, activities, tickets, and parking; overnight trips connect to hotels, insurance, eSIMs, and rentals. Public deployment, affiliate enrollment, and external promotion remain owner-gated.

## Evidence boundary

The model is transparent planning guidance, not scientific truth. It is deterministically and browser tested, including scenario sensitivity and fail-closed invalid inputs, but it is not calibrated or real-user-proven until prospective travelers rate recommendations and actual outcomes.
