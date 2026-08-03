import base64
import json
import time
import urllib.request
from pathlib import Path
import websocket

ROOT = Path(__file__).resolve().parent
PORT = 9223
req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?http://127.0.0.1:8080/", method="PUT")
with urllib.request.urlopen(req, timeout=5) as response:
    target = json.load(response)
ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=10, suppress_origin=True)
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
    deadline = time.time() + 10
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
navigate("http://127.0.0.1:8080/")

local = evaluate("""(() => ({
  title: document.title,
  type: document.querySelector('[name="tripType"]:checked').value,
  options: [...document.querySelectorAll('.stay-option strong')].map(x => x.textContent),
  factors: document.querySelectorAll('.factor').length,
  score: Number(document.querySelector('#score').textContent),
  destination: document.querySelector('#destination-label').textContent,
  urlVersion: location.search.includes('v=0.2'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  errorsHidden: document.querySelector('#validation-errors').hidden
}))()""")
assert local["type"] == "outing"
assert local["options"] == ["2 hours", "3 hours", "4.5 hours", "6 hours"]
assert local["factors"] == 6 and 0 <= local["score"] <= 100
assert local["urlVersion"] and not local["overflow"] and local["errorsHidden"]
screenshot(ROOT / "desktop-preview.png")

sensitivity = evaluate("""(() => {
  const before = Number(document.querySelectorAll('.stay-option strong')[1].textContent.split(' ')[0]);
  for (const [id,value] of [['logistics','heavy'],['coordination','group'],['energy','low']]) {
    const el=document.querySelector('#'+id); el.value=value; el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  const after = Number(document.querySelectorAll('.stay-option strong')[1].textContent.split(' ')[0]);
  return {before, after, urlHasControls: location.search.includes('coordination=group') && location.search.includes('energy=low')};
})()""")
assert sensitivity["after"] > sensitivity["before"] and sensitivity["urlHasControls"]

long_trip = evaluate("""(() => {
  document.querySelector('[data-preset="tokyo"]').click();
  return {
    type: document.querySelector('[name="tripType"]:checked').value,
    destination: document.querySelector('#destination-label').textContent,
    options: [...document.querySelectorAll('.stay-option strong')].map(x => x.textContent),
    nightsVisible: !document.querySelector('#nights').closest('label').hidden,
    visitHidden: document.querySelector('#visitHours').closest('label').hidden,
    factors: document.querySelectorAll('.factor').length
  };
})()""")
assert long_trip["type"] == "overnight" and long_trip["destination"] == "Tokyo"
assert len(long_trip["options"]) == 4 and all("nights" in value for value in long_trip["options"])
assert long_trip["nightsVisible"] and long_trip["visitHidden"] and long_trip["factors"] == 6

call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
navigate("http://127.0.0.1:8080/?v=0.2&tripType=outing&destination=Foster+City+%E2%86%92+Hillsborough&purpose=visiting&activity=meal&oneWayAmount=20&oneWayUnit=minutes&visitHours=1.5&logistics=easy&coordination=pair&energy=normal&currency=USD&transportCost=8&stayOrActivityCost=25&extraCosts=0&totalBudget=60&excitement=8&importance=4&pace=packed")
mobile = evaluate("""(() => ({
  destination: document.querySelector('#destination-label').textContent,
  options: [...document.querySelectorAll('.stay-option strong')].map(x => x.textContent),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  factors: document.querySelectorAll('.factor').length,
  errorsHidden: document.querySelector('#validation-errors').hidden
}))()""")
assert mobile["destination"] == "Foster City → Hillsborough"
assert len(mobile["options"]) == 4 and not mobile["overflow"] and mobile["factors"] == 6 and mobile["errorsHidden"]
screenshot(ROOT / "mobile-preview.png")

bad = evaluate("""(() => {
  const el=document.querySelector('#visitHours'); el.value='0'; el.dispatchEvent(new Event('input',{bubbles:true}));
  return {hidden:document.querySelector('#validation-errors').hidden, score:document.querySelector('#score').textContent, options:document.querySelectorAll('.stay-option').length, invalidShared:location.search.includes('visitHours=0')};
})()""")
assert not bad["hidden"] and bad["score"] == "—" and bad["options"] == 0 and not bad["invalidShared"]
errors = [event for event in events if event.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
assert not errors, errors
receipt = {"status":"PASS","local":local,"sensitivity":sensitivity,"longTrip":long_trip,"mobile":mobile,"invalid":bad,"consoleErrors":len(errors)}
(ROOT / "browser-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, indent=2))
call("Target.closeTarget", {"targetId": target["id"]})
ws.close()
