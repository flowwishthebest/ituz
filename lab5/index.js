const xpath = require('xpath');
const xmldom = require('xmldom');
const path = require('path');
const fs = require('fs');
const pg = require('pg');

require('dotenv').config();

const dataDir = 'docs';
const xmlFileName = 'rufallout_pages_current_small.xml';

const filepath = path.join(process.cwd(), dataDir, xmlFileName);

const xmlParser = new xmldom.DOMParser();

console.log(process.env.POSTGRES_USER);

const pgClient = new pg.Client({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
});

async function main() {

    await pgClient.connect();

    let xmlFile;
    try {
        xmlFile = await fs.promises.readFile(
            filepath,
            { encoding: 'utf-8' },
        );
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    const processedXmlFile = xmlFile.replace(/\n/g, '');
    
    const xmlDoc = xmlParser.parseFromString(processedXmlFile);
    
    console.log(xmlFile.slice(0, 100), 'totalFileSize', processedXmlFile.length);

    const PAGES_XPATH_EXPR = '//page';

    const result = xpath.evaluate(
        PAGES_XPATH_EXPR,
        xmlDoc, 
        null,
        xpath.XPathResult.ANY_TYPE,
        null,
    );

    const CATEGORIES_REGEXP = /\[\[Категория:[\s\S]+\]\]/gi;
    const TAGS_REGEXP = /^\[\[(.*)\]\]/gi;

    let node = result.iterateNext();

    while (node) {
        const title = xpath.select1('string(title/text())', node);
        const text = xpath.select1('string(revision/text/text())', node);
        const revisionNo = xpath.select1('string(revision/id/text())', node);
        const revisionTs = xpath.select1('string(revision/timestamp/text())', node);
        const comment = xpath.select1('string(revision/comment/text())', node);

        const categories = text.match(CATEGORIES_REGEXP) || [];
        const tags = text.match(TAGS_REGEXP) || [];

        let okWordsCount = 0;
        let badWordsCount = 0;

        const positivityIdx = okWordsCount - badWordsCount;

        const heroes = [];
     
        node = result.iterateNext();
    }

    await pgClient.end();

    
    // console.log(titles.slice(0, 5));
}

main().catch((err) => {
    console.error(err);
});

const badWords = [];
const okWords = [];

const howGoodTheArticle = (positivityIdx) => {
    if (positivityIdx === 0) {
        return 'Статья на "Удовлетворительно"';
    }
    if (positivityIdx === 1) {
        return '';
    }
};


/**
 * Извлечь в таблицу поля по отдельным колонкам:

1. Заголовок. !
2. Текст. !
3. Номер ревизии. !
4. Время ревизии в формате timestamp (используйте, при необходимости, regexp) !
5. Комментарий. !
Добавьте дополнительные поля в таблицу и загрузите в них:
1. Список тегов ([[Очки здоровья]], [[Выносливость]] и пр.). !
2. Список категорий ([[Категория:Бой]], [[Категория:Производные характеристики Fallout]]..) !
3. Список негативных слов в статье (см.ниже).
4. Список позитивных слов в статье (см.ниже).
5. Индекс позитива числом (см.ниже).
6. Список героев.
7. Вывод (см. ниже)

Добавьте словари (в любой форме реализации) плохих слов (яд, отравление, ...) и хороших (выздоровел, молодец...) и в специальное поле укажите индекс позитива цифрой (Пример: индекс 5, когда 6 хороших слова и 1 плохое) и в поле "вывод" напишите словами содержащими (очень плохо, плохо, удовлетворительно, хорошо, отлично) в зависимости от индекса.

Добавьте словарь определяющий имена героев. В поле вывод фразу "Статья про ..." указав самого популярного (часто стречающегося) героя на странице.

Проверить вручную работу алгоритма отсортировав по индексу позитива.



В качестве ответа приложить ссылку на sql-файл выполняющий задание.
 */
