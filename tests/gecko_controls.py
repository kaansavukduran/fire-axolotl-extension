# SPDX-License-Identifier: MPL-2.0
"""Operate actual HTML controls, including prefixed HTML in Firefox chrome."""
from selenium.webdriver.common.by import By


def choose_option(driver, element_id, value):
    control = driver.find_element(By.ID, element_id)
    assert driver.execute_script('return arguments[0].localName === "select" && arguments[0].namespaceURI === "http://www.w3.org/1999/xhtml";', control)
    for option in control.find_elements(By.CSS_SELECTOR, 'option'):
        if option.get_attribute('value') == str(value):
            if not option.is_selected():
                option.click()
            return
    raise AssertionError(f'No option {value} in {element_id}')
