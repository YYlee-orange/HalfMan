// Enter through real level buttons after the opening, preserving the tested route.
export async function chooseFirstLevel(page){
  await page.click('[data-level="man-1"]');await page.click('[data-level="man-1"]');
  await page.evaluate(()=>window.__MAN_QA__.finishSceneTransition());
}
