const { verifyPassword } = require("./src/utils/password");

(async () => {
  const stored = "b47b5b4031a996a44060fd54e2144152:71d656414785085d50a03cf362042b3204dbe96925b732e1a449bf7a6d57b40021a0f39f263e7dc03e7abad33512e85b698945fbb625b4d62398a3cb6a018bfa";
  const result = await verifyPassword("123456", stored);
  console.log("RESULTADO:", result);
})();
