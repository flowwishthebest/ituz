const xpath = require('xpath');
const xmldom = require('xmldom');
const path = require('path');
const fs = require('fs');
const sax = require('sax');
const saxpath = require('saxpath');
const xml2js = require('xml2js');

const { howGoodTheArticle } = require('./how-good-the-article');
const { client } = require('./db');

const CATEGORIES_REGEXP = /\[\[Категория:[\s\S]+\]\]/gi;
const TAGS_REGEXP = /^\[\[(.*)\]\]/gi;

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
    return result.rows.map(({ name }) => name);
}

async function insertParsedData(
    client,
    header, txt, revision_no, revision_ts,
    comment, tags, categories, badWords, okWords,
    positivityIdx, heroes, conclusion, okWordsCount, badWordsCount,
) {

    const query = `
    INSERT INTO parsed_xml_data (
        header, txt, revision_no, revision_ts,
        comment, tags, categories, bad_words, ok_words,
        positivity_idx, heroes, conclusion,
        ok_words_count, bad_words_count)
    VALUES ($1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14)`;

    await client.query(query, [
        header, txt, revision_no, revision_ts,
        comment, tags, categories, badWords, okWords,
        positivityIdx, heroes, conclusion, okWordsCount,
        badWordsCount,
    ]);
}

async function truncatePreviousParsed(client) {
    await client.query('DELETE FROM parsed_xml_data');
}

const dataDir = 'docs';
// const xmlFileName = 'rufallout_pages_current_small.xml';
const xmlFileName = '66eeafefeafe4caa1044e0d55600e022.xml';

const filepath = path.join(process.cwd(), dataDir, xmlFileName);

const xmlParser = new xmldom.DOMParser();

async function s() {

    await client.connect();

    const okWords = await loadOkWords(client);
    const badWords = await loadBadWords(client);
    const heroNames = await loadHeroNames(client);

    const fileStream = fs.createReadStream(filepath);
    const saxParser = sax.createStream(true);
    const streamer = new saxpath.SaXPath(saxParser, '//page');

    streamer.on('match', function(xml) {
        xml2js.parseStringPromise(xml).then((d) => {
            const title = d.page.title[0];
            const text = d.page.revision[0].text[0]._ || '';

            const revisionNo =  d.page.revision[0].id[0];
            const revisionTs =  d.page.revision[0].timestamp[0]
            const comment =  ((d.page.revision[0].comment) || [])[0] || '';

            const categories = text.match(CATEGORIES_REGEXP) || [];

            const tags = text.match(TAGS_REGEXP) || [];
    
            const processedText = processText(text);
    
            let _okWords = [];
            let _badWords = [];
            const _heroes = new Map();
    
            identifyOkAndBadWords(processedText, okWords, badWords, _okWords, _badWords);
            identifyHeroes(processedText, heroNames, _heroes);
    
            const positivityIdx = _okWords.length - _badWords.length;
    
            const conclusion = getConclusion(positivityIdx, _heroes);
    
            // console.log(_heroes, _okWords, _badWords, conclusion, positivityIdx);
    
            insertParsedData(client,
                title, processedText, revisionNo, revisionTs, comment,
                tags, processCategories(categories), _badWords.join(', '),
                _okWords.join(', '), positivityIdx,
                Array.from(_heroes.entries()).map(([k, v]) => `${k}:${v}`).join(', '),
                conclusion, _okWords.length, _badWords.length,
            ).then(() => {
                console.log(revisionNo, ' wrote');
            }).catch((err) => {
                console.error(err);
            });
        });
    });

    fileStream.pipe(saxParser);
}

// Dlya big razmera
// s().catch(err => {
//     console.error(err);
// });

// Dlya small razmera
async function main() {

    const xmlFile = await fs.promises.readFile(filepath,{ encoding: 'utf-8' });

    const processedXmlFile = xmlFile.replace(/\n/g, '');

    const xmlDoc = xmlParser.parseFromString(processedXmlFile);

    console.log(xmlFile.slice(0, 100), 'totalFileSize', processedXmlFile.length);

    await client.connect();

    await truncatePreviousParsed(client);

    const okWords = await loadOkWords(client);
    const badWords = await loadBadWords(client);
    const heroNames = await loadHeroNames(client);

    console.log('okWords', okWords)
    console.log('badWords', badWords);
    console.log('heroesNames', heroNames);

    const PAGES_XPATH_EXPR = '//page';

    const result = xpath.evaluate(
        PAGES_XPATH_EXPR,
        xmlDoc, 
        null,
        xpath.XPathResult.ANY_TYPE,
        null,
    );

    let node = result.iterateNext();

    console.log('Node is', node);

    while (node) {
        const title = xpath.select1('string(title/text())', node);
        const text = xpath.select1('string(revision/text/text())', node);
        const revisionNo = xpath.select1('string(revision/id/text())', node);
        const revisionTs = xpath.select1('string(revision/timestamp/text())', node);
        const comment = xpath.select1('string(revision/comment/text())', node);

        const categories = text.match(CATEGORIES_REGEXP) || [];

        const tags = text.match(TAGS_REGEXP) || [];

        const processedText = processText(text);

        let _okWords = [];
        let _badWords = [];
        const _heroes = new Map();

        identifyOkAndBadWords(processedText, okWords, badWords, _okWords, _badWords);
        identifyHeroes(processedText, heroNames, _heroes);

        const positivityIdx = _okWords.length - _badWords.length;

        const conclusion = getConclusion(positivityIdx, _heroes);

        console.log(_heroes, _okWords, _badWords, conclusion, positivityIdx);

        await insertParsedData(client,
            title, processedText, revisionNo, revisionTs, comment,
            tags, processCategories(categories), _badWords.join(', '),
            _okWords.join(', '), positivityIdx,
            Array.from(_heroes.entries()).map(([k, v]) => `${k}:${v}`).join(', '),
            conclusion, _okWords.length, _badWords.length,
        );

        node = result.iterateNext();
    }

    await client.end();
}

function identifyOkAndBadWords(text, okWordsIn, badWordsIn, okWordsOut, badWordsOut) {
    text.split(' ').forEach((w) => {
        const lcWord = w.toLowerCase();

        if (okWordsIn.includes(lcWord)) {
            okWordsOut.push(w);
        }

        if (badWordsIn.includes(lcWord)) {
            badWordsOut.push(w);
        }
    });
}

function identifyHeroes(text, heroesIn, heroesOut) {
    text.split(' ').forEach((w) => {
        const isHeroName = heroesIn.some((h) => h === w);

        if (isHeroName) {
            if (heroesOut.has(w)) {
                const score = heroesOut.get(w);
                heroesOut.set(w, score + 1);
            } else {
                heroesOut.set(w, 1);
            }
        }
    });
}

function processCategories(categories) {
    return categories
        .map((cats) => cats.replace(/[\]\[]/gi, '').split('Категория:').filter((c) => c.length))
        .join(', ');
}

function processText(text) {
    return text.replace(/\n\r/gi, ' ')
        .replace('/^\w\-/', ' ')
        .replace(/\-\s/gi, ' ')
        .replace(/\s\-/gi, ' ')
        .replace(/\s{2,}/gi, ' ');
}

main().catch((err) => {
    console.error(err);

    client.end().catch((err) => {
        console.error(err);
    });
});
