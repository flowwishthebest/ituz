const xpath = require('xpath');
const xmldom = require('xmldom');
const path = require('path');
const fs = require('fs');
const pg = require('pg');
const { howGoodTheArticle } = require('./how-good-the-article');

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

    const xmlFile = await fs.promises.readFile(filepath,{ encoding: 'utf-8' });

    const processedXmlFile = xmlFile.replace(/\n/g, '');

    const xmlDoc = xmlParser.parseFromString(processedXmlFile);

    console.log(xmlFile.slice(0, 100), 'totalFileSize', processedXmlFile.length);

    await pgClient.connect();

    truncatePreviousParsed(pgClient);

    const okWords = await loadOkWords(pgClient);
    const badWords = await loadBadWords(pgClient);
    const heroNames = await loadHeroNames(pgClient);

    console.log('okWords', okWords)
    console.log('badWords', badWords);
    console.log('heroesNames', heroesNames);

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

        let _okWords = [];
        let _badWords = [];
        const _heroes = new Map();

        text.split(' ').forEach((w) => {
            const lcWord = w.toLowerCase();

            if (okWords.includes(lcWord)) {
                _okWords.push(lcWord);
            } else if (badWords.includes(lcWord)) {
                _badWords.push(lcWord);
            } else if (isHeroName(w)) {
                if (_heroes.has(w)) {
                    const score = _heroes.get(w);
                    _heroes.set(w, score + 1);
                } else {
                    _heroes.set(w, 1);
                }
            }
        })

        const positivityIdx = _okWords.length - _badWords.length;

        const conclusion = getConclusion(positivityIdx, _heroes);

        // console.log(_heroes, _okWords, _badWords, conclusion, positivityIdx);

        await insertParsedData(pgClient,
            title, text, revisionNo, revisionTs, comment,
            tags, categories, _badWords.join(', '),
            _okWords.join(', '), positivityIdx,
            Array.from(_heroes.entries()).map(([k, v]) => `${k}:${v}`).join(', '),
            conclusion,
        );
     
        node = result.iterateNext();
    }

    await pgClient.end();
}

main().catch((err) => {
    console.error(err);
});

function isHeroName(word) {
    return heroNames.some((n) => n === word);
}

function aboutWhatHeroesTheArticle(heroes) {
    let n = 'unknown';
    let score = 0;
    for (const [name, count] of heroes.entries()) {
        if (count > score) {
            n = name;
            score = count
        }
    }

    if (score > 0) {
        return 'Эта статья про ' + n;
    } else {
        return 'Эта статья ни о ком';
    }
}  

function getConclusion(posIdx, heroes) {
    const aboutPositivity = howGoodTheArticle(posIdx);
    const aboutHero = aboutWhatHeroesTheArticle(heroes);

    return aboutPositivity + ' ' + aboutHero;
}

async function loadBadWords(client) {
    const result = await client.query('SELECT value from bad_word');
    return result.rows.map(({ value }) => value);
}

async function loadOkWords(client) {
    const result = await client.query('SELECT value from ok_word');
    return result.rows.map(({ value }) => value);
}

async function loadHeroNames(client) {
    const result = await client.query('SELECT name from hero_name');
    return result.rows;
}

async function insertParsedData(
    client,
    header, txt, revision_no, revision_ts,
    comment, tags, categories, badWords, okWords,
    positivityIdx, heroes, conclusion,
) {

    const query = `
    INSERT INTO parsed_xml_data (
        header, txt, revision_no, revision_ts,
        comment, tags, categories, bad_words, ok_words,
        positivity_idx, heroes, conclusion)
    VALUES ($1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12)`;

    await client.query(query, [
        header, txt, revision_no, revision_ts,
        comment, tags, categories, badWords, okWords,
        positivityIdx, heroes, conclusion,
    ]);
}

async function truncatePreviousParsed(client) {
    await client.query('DELETE FROM parsed_xml_data');
}
