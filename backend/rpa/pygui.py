import pyautogui
import time

time.sleep(2)

# เปิด tab
pyautogui.hotkey("ctrl", "t")

# พิมพ์ url
pyautogui.write("https://google.com")

# Enter
pyautogui.press("enter")