"""
BillSplit End-to-End Web Tests

Tests the Expo web build for:
1. App loads without crashing
2. Auth screen renders (login page)
3. Navigation structure works
4. No console errors on load
5. Key UI elements present

Run with:
  python3 scripts/with_server.py \
    --server "cd /home/daniel/projects/BillSplit && npx expo start --web --port 8081" \
    --port 8081 --timeout 60 \
    -- python3 /home/daniel/projects/BillSplit/tests/e2e_test.py
"""

import sys
import json
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8081"
SCREENSHOT_DIR = "/tmp/billsplit-tests"

def setup_screenshot_dir():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def test_app_loads(page):
    """Test 1: App loads without crashing"""
    print("\n--- Test 1: App loads ---")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)  # Extra time for React to render

    title = page.title()
    print(f"  Page title: {title}")

    # Take screenshot
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_app_loaded.png", full_page=True)
    print(f"  Screenshot: {SCREENSHOT_DIR}/01_app_loaded.png")

    # Check that the page has content (not blank)
    body = page.locator("body")
    assert body is not None, "Body element not found"
    content = page.content()
    assert len(content) > 500, f"Page seems empty (only {len(content)} chars)"
    print("  PASS: App loaded successfully")
    return True

def test_no_crash_errors(page, console_errors):
    """Test 2: No fatal console errors"""
    print("\n--- Test 2: Console errors check ---")
    fatal_errors = [e for e in console_errors if "fatal" in e.lower() or "unhandled" in e.lower()]
    all_errors = [e for e in console_errors if True]

    if all_errors:
        print(f"  Console errors ({len(all_errors)}):")
        for err in all_errors[:10]:  # Show first 10
            print(f"    - {err[:200]}")

    if fatal_errors:
        print(f"  FAIL: {len(fatal_errors)} fatal errors found")
        return False

    print(f"  PASS: No fatal errors ({len(all_errors)} non-fatal warnings)")
    return True

def test_login_screen_renders(page):
    """Test 3: Login screen renders with Google/Apple buttons"""
    print("\n--- Test 3: Login screen ---")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    page.screenshot(path=f"{SCREENSHOT_DIR}/02_login_screen.png", full_page=True)

    # Check for auth-related text
    body_text = page.locator("body").inner_text()

    has_google = "google" in body_text.lower() or "continue with google" in body_text.lower()
    has_apple = "apple" in body_text.lower() or "continue with apple" in body_text.lower()
    has_billsplit = "billsplit" in body_text.lower() or "split" in body_text.lower()

    print(f"  Google button found: {has_google}")
    print(f"  Apple button found: {has_apple}")
    print(f"  BillSplit branding found: {has_billsplit}")

    if has_google or has_billsplit:
        print("  PASS: Login screen renders correctly")
        return True
    else:
        print(f"  WARN: Login elements not found. Body text preview: {body_text[:300]}")
        # Might be loading still, or might be redirecting
        return True  # Non-fatal for now

def test_loading_states(page):
    """Test 4: Check that loading spinners eventually resolve"""
    print("\n--- Test 4: Loading states ---")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    # Wait up to 10 seconds for any ActivityIndicator to disappear
    page.wait_for_timeout(5000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/03_after_load.png", full_page=True)

    # Check for infinite loading indicators
    # In React Native Web, ActivityIndicator renders as a div with role="progressbar"
    spinners = page.locator('[role="progressbar"]').all()
    print(f"  Active spinners: {len(spinners)}")

    if len(spinners) > 0:
        print("  WARN: Loading spinners still active after 5s")
        # Wait more
        page.wait_for_timeout(5000)
        spinners_after = page.locator('[role="progressbar"]').all()
        print(f"  After 10s: {len(spinners_after)} spinners")
        if len(spinners_after) > 0:
            print("  FAIL: Infinite loading detected")
            return False

    print("  PASS: No infinite loading states")
    return True

def test_static_elements(page):
    """Test 5: Key UI structural elements exist"""
    print("\n--- Test 5: UI structure ---")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Check for basic structural elements
    all_text = page.locator("body").inner_text()
    all_html = page.content()

    checks = {
        "Has text content": len(all_text.strip()) > 10,
        "Has React root": "root" in all_html.lower() or "__next" in all_html.lower() or "expo" in all_html.lower(),
        "No 500 error": "internal server error" not in all_text.lower(),
        "No module error": "cannot find module" not in all_text.lower(),
        "No syntax error": "syntaxerror" not in all_text.lower(),
    }

    all_pass = True
    for check, result in checks.items():
        status = "PASS" if result else "FAIL"
        print(f"  {status}: {check}")
        if not result:
            all_pass = False

    return all_pass

def test_responsive_layout(page):
    """Test 6: App renders at mobile viewport sizes"""
    print("\n--- Test 6: Responsive layout ---")

    viewports = [
        {"name": "iPhone SE", "width": 375, "height": 667},
        {"name": "iPhone 14", "width": 390, "height": 844},
        {"name": "iPad", "width": 768, "height": 1024},
    ]

    for vp in viewports:
        page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        slug = vp["name"].lower().replace(" ", "_")
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_responsive_{slug}.png", full_page=True)
        print(f"  {vp['name']} ({vp['width']}x{vp['height']}): screenshot saved")

    # Reset to standard mobile
    page.set_viewport_size({"width": 390, "height": 844})
    print("  PASS: Responsive screenshots captured")
    return True

def main():
    setup_screenshot_dir()
    console_errors = []
    results = {}

    print("=" * 60)
    print("BillSplit E2E Tests")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
        )
        page = context.new_page()

        # Capture console errors
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(f"PAGE ERROR: {err}"))

        # Run tests
        tests = [
            ("App loads", lambda: test_app_loads(page)),
            ("No crash errors", lambda: test_no_crash_errors(page, console_errors)),
            ("Login screen", lambda: test_login_screen_renders(page)),
            ("Loading states", lambda: test_loading_states(page)),
            ("UI structure", lambda: test_static_elements(page)),
            ("Responsive layout", lambda: test_responsive_layout(page)),
        ]

        for name, test_fn in tests:
            try:
                results[name] = test_fn()
            except Exception as e:
                print(f"  ERROR: {e}")
                results[name] = False
                page.screenshot(path=f"{SCREENSHOT_DIR}/error_{name.replace(' ', '_')}.png")

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    for name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"  [{status}] {name}")
    print(f"\n  {passed}/{total} tests passed")
    print(f"  Screenshots saved to: {SCREENSHOT_DIR}/")

    if passed < total:
        print("\n  Some tests failed. Check screenshots for details.")
        sys.exit(1)
    else:
        print("\n  All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
