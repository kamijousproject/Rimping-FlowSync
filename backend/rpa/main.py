from selenium import webdriver
from selenium.webdriver.common.by import By
import time

# เปิด Chrome
driver = webdriver.Chrome()

# เปิด Google
driver.get("https://google.com")

# เปิดแท็บใหม่
driver.switch_to.new_window("tab")

# ไปหน้า Google อีกแท็บ
driver.get("https://google.com")

time.sleep(10)

driver.quit()