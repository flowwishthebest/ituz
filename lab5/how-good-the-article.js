function howGoodTheArticle(positivityIdx) {
    if (positivityIdx >= 5) {
        return 'Статья очень хорошая';
    }
    if (positivityIdx <= -5) {
        return 'Статья очень плохая';
    }
    if (positivityIdx <= 1 && positivityIdx >= -1) {
        return 'Статья на удовлетворительно';
    }
    if (positivityIdx > 1 && positivityIdx < 5) {
        return 'Статья хорошая';
    }

    return 'Статья плохая';
};

module.exports = {
    howGoodTheArticle,
};
