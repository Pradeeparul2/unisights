page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));
page.on("pageerror", (err) => console.log("BROWSER ERROR:", err));

npx playwright test tests/framework.spec.ts --headed

python -m pip install -r requirements.txt
python -m pip install -e ../packages/python

# Install the local Unisights Python package and framework dependencies before running E2E tests.
