const { howGoodTheArticle } = require('../how-good-the-article');

for (const i of [-10, -5, -3, -1, 0, 1, 3, 5, 10]) {
    console.log(howGoodTheArticle(i), i);
}