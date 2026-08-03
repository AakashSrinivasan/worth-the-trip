import base64
import json
import os
import time
import urllib.request
from pathlib import Path
import websocket

ROOT = Path(__file__).resolve().parent
PORT = 9223
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8080").rstrip("/")
req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?{BASE_URL}/", method="PUT")
with urllib.request.urlopen(req, timeout=5) as response:
    target = json.load(response)
ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=15, suppress_origin=True)
next_id = 0
events = []

def call(method, params=None):
    global next_id
    next_id += 1
    current = next_id
    ws.send(json.dumps({"id": current, "method": method, "params": params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get("id") == current:
            if "error" in message:
                raise RuntimeError(message["error"])
            return message.get("result", {})
        events.append(message)

def evaluate(expression):
    result = call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    return result.get("result", {}).get("value")

def navigate(url):
    call("Page.navigate", {"url": url})
    deadline = time.time() + 15
    while time.time() < deadline:
        if evaluate("document.readyState") == "complete" and evaluate("document.querySelectorAll('.stay-option').length") == 4:
            return
        time.sleep(0.1)
    raise TimeoutError("Page did not become ready")

def screenshot(path):
    shot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
    path.write_bytes(base64.b64decode(shot["data"]))

call("Page.enable")
call("Runtime.enable")
call("Log.enable")
call("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
navigate(f"{BASE_URL}/")

desktop = evaluate("""(() => ({
  title: document.title,
  type: document.querySelector('[name="tripType"]:checked').value,
  summary: document.querySelector('#result-summary').textContent,
  options: [...document.querySelectorAll('.stay-option strong')].map(x => x.textContent),
  optionalOpen: document.querySelector('#optional-fields').open,
  travelOutput: document.querySelector('#travel-time-output').textContent,
  travelAria: document.querySelector('#travelTimeRange').getAttribute('aria-valuetext'),
  quickButtons: document.querySelectorAll('[data-travel-minutes]').length,
  methodologyPresent: document.querySelectorAll('.methodology,.factor-list').length === 2,
  sliders: document.querySelectorAll('input[type="range"]').length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  errorsHidden: document.querySelector('#validation-errors').hidden,
  urlVersion: location.search.includes('v=0.4')
}))()""")
assert desktop["title"] == "Worth The Trip?"
assert desktop["type"] == "outing" and "3 hours" in desktop["summary"]
assert desktop["options"] == ["2 hours", "3 hours", "4.5 hours", "6 hours"]
assert not desktop["optionalOpen"] and desktop["travelOutput"] == "20 min" and desktop["travelAria"] == "20 min"
assert desktop["quickButtons"] == 0
assert desktop["methodologyPresent"] and desktop["sliders"] >= 9
assert not desktop["overflow"] and desktop["errorsHidden"] and desktop["urlVersion"]
screenshot(ROOT / "desktop-preview.png")

slider_cases = evaluate("""(() => {
  const slider=document.querySelector('#travelTimeRange');
  slider.value='1'; slider.dispatchEvent(new Event('input',{bubbles:true}));
  const tenMin={
    output:document.querySelector('#travel-time-output').textContent,
    amount:document.querySelector('#oneWayAmount').value,
    unit:document.querySelector('#oneWayUnit').value,
    summary:document.querySelector('#result-summary').textContent,
    url:location.search
  };
  slider.value='14'; slider.dispatchEvent(new Event('input',{bubbles:true}));
  const tenHour={
    output:document.querySelector('#travel-time-output').textContent,
    amount:document.querySelector('#oneWayAmount').value,
    unit:document.querySelector('#oneWayUnit').value,
    summary:document.querySelector('#result-summary').textContent,
    url:location.search
  };
  return {tenMin,tenHour};
})()""")
assert slider_cases["tenMin"]["output"] == "10 min" and slider_cases["tenMin"]["amount"] == "10" and slider_cases["tenMin"]["unit"] == "minutes"
assert "oneWayAmount=10" in slider_cases["tenMin"]["url"] and "oneWayUnit=minutes" in slider_cases["tenMin"]["url"]
assert slider_cases["tenHour"]["output"] == "10 hr" and slider_cases["tenHour"]["amount"] == "10" and slider_cases["tenHour"]["unit"] == "hours"
assert "oneWayAmount=10" in slider_cases["tenHour"]["url"] and "oneWayUnit=hours" in slider_cases["tenHour"]["url"]
assert slider_cases["tenMin"]["summary"] != slider_cases["tenHour"]["summary"]

optional = evaluate("""(() => {
  const details=document.querySelector('#optional-fields'); details.querySelector('summary').click();
  const open=details.open;
  const controlVisible=!!document.querySelector('#coordinationSlider').offsetParent;
  for (const [id,value] of [['logistics','heavy'],['coordination','group'],['energy','low']]) {
    const el=document.querySelector('#'+id); el.value=value; el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  return {open,controlVisible,urlHasOptional:location.search.includes('coordination=group') && location.search.includes('energy=low')};
})()""")
assert optional == {"open": True, "controlVisible": True, "urlHasOptional": True}

shared_url = f"{BASE_URL}/?v=0.3&tripType=outing&destination=Foster+City+%E2%86%92+Hillsborough&purpose=visiting&activity=meal&oneWayAmount=20&oneWayUnit=minutes&visitHours=1.5&logistics=easy&coordination=pair&energy=normal&currency=USD&transportCost=8&stayOrActivityCost=25&extraCosts=0&totalBudget=60&excitement=8&importance=4&pace=packed"
navigate(shared_url)
hydration = evaluate("""(() => ({
  destination:document.querySelector('#destination-label').textContent,
  exactAmount:document.querySelector('#oneWayAmount').value,
  exactUnit:document.querySelector('#oneWayUnit').value,
  sliderOutput:document.querySelector('#travel-time-output').textContent,
  visitExact:document.querySelector('#visitHours').value,
  visitSlider:document.querySelector('#visitHoursRange').value,
  purpose:document.querySelector('[name="purpose"]:checked').value,
  summary:document.querySelector('#result-summary').textContent
}))()""")
assert hydration["destination"] == "FOSTER CITY → HILLSBOROUGH"
assert hydration["exactAmount"] == "20" and hydration["exactUnit"] == "minutes" and hydration["sliderOutput"] == "20 min"
assert hydration["visitExact"] == "1.5" and hydration["visitSlider"] == "1.5" and hydration["purpose"] == "visiting"

long_trip_url = f"{BASE_URL}/?v=0.3&tripType=overnight&destination=Tokyo&purpose=leisure&oneWayAmount=10&oneWayUnit=hours&nights=5&logistics=normal&coordination=pair&energy=normal&currency=USD&transportCost=900&stayOrActivityCost=160&extraCosts=350&totalBudget=2500&ptoDays=5&timezoneDelta=8&excitement=9&importance=3&pace=balanced"
navigate(long_trip_url)
long_trip = evaluate("""(() => ({
  type:document.querySelector('[name="tripType"]:checked').value,
  travelOutput:document.querySelector('#travel-time-output').textContent,
  nightsVisible:!document.querySelector('#nights').closest('.overnight-only').hidden,
  visitHidden:document.querySelector('#visitHours').closest('.outing-only').hidden,
  options:[...document.querySelectorAll('.stay-option strong')].map(x=>x.textContent),
  summary:document.querySelector('#result-summary').textContent
}))()""")
assert long_trip["type"] == "overnight" and long_trip["travelOutput"] == "10 hr"
assert long_trip["nightsVisible"] and long_trip["visitHidden"] and len(long_trip["options"]) == 4
assert all("nights" in value for value in long_trip["options"])

call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
navigate(shared_url)
mobile = evaluate("""(() => ({
  destination:document.querySelector('#destination-label').textContent,
  summary:document.querySelector('#result-summary').textContent,
  overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth,
  options:document.querySelectorAll('.stay-option').length,
  optionalOpen:document.querySelector('#optional-fields').open,
  dashboardPieces:document.querySelectorAll('.score,.score-row,.factor-bar').length,
  errorsHidden:document.querySelector('#validation-errors').hidden
}))()""")
assert mobile["destination"] == "FOSTER CITY → HILLSBOROUGH" and mobile["options"] == 4
assert not mobile["overflow"] and not mobile["optionalOpen"] and mobile["dashboardPieces"] == 0 and mobile["errorsHidden"]
screenshot(ROOT / "mobile-preview.png")

bad = evaluate("""(() => {
  const el=document.querySelector('#visitHours'); el.value='0'; el.dispatchEvent(new Event('input',{bubbles:true}));
  return {hidden:document.querySelector('#validation-errors').hidden, summary:document.querySelector('#result-summary').textContent, options:document.querySelectorAll('.stay-option').length, invalidShared:location.search.includes('visitHours=0')};
})()""")
assert not bad["hidden"] and "Fix" in bad["summary"] and bad["options"] == 0 and not bad["invalidShared"]
errors = [event for event in events if event.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
assert not errors, errors
receipt = {"status":"PASS","desktop":desktop,"sliderCases":slider_cases,"optional":optional,"hydration":hydration,"longTrip":long_trip,"mobile":mobile,"invalid":bad,"consoleErrors":len(errors)}
(ROOT / "browser-receipt.json").write_text(json.dumps(receipt,indent=2)+"\n")
print(json.dumps(receipt,indent=2))
call("Target.closeTarget", {"targetId": target["id"]})
ws.close()
