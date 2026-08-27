(() => {
  // app.js defines translations as a global lexical binding; classic scripts loaded
  // afterwards can refine those strings without changing the main application logic.
  try {
    translations.he.photoResultIntro = 'התמונה נותחה במכשיר באמצעות מנוע זיהוי מקומי רחב. התוצאה היא הערכה בלבד, ולכן מומלץ לאמת אותה מול התמונות והמידע.';
    translations.en.photoResultIntro = 'The image was analysed on your device using the larger local identification engine. The result is still an estimate and should be verified against images and information.';
    translations.ar.photoResultIntro = 'تم تحليل الصورة على جهازك باستخدام محرك تعرّف محلي أوسع. تبقى النتيجة تقديرية ويُفضّل التحقق منها بالصور والمعلومات.';
  } catch (error) {
    console.warn('Could not update OpenPlants UI text.', error);
  }
})();
