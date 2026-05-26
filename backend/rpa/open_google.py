from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        headless=False
    )

    page = browser.new_page()

    # เปิด Google
    page.goto("https://google.com")

    # เปิด tab ใหม่
    tab2 = browser.new_page()
    tab2.goto("https://google.com")

    input("กด Enter เพื่อปิด")
    browser.close()