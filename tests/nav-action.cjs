exports.clickNav=async(page,selector)=>{
 const action=page.locator(selector);
 if(!await action.isVisible())await page.locator('.nav-toggle').click();
 await action.click();
};
