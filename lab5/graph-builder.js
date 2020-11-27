const { client } = require('./db');
const graphviz = require('graphviz');
const fs = require('fs');

const cache = {};

function getFromCache(n, g) {
    if (cache[n]) {
        return cache[n];
    } else {
        const num = generateRandomNumber(10, 1000000);
        // const node = g.addNode(num, { label: n });
        const node = g.addNode(num, { label: n });
        cache[n] = node;
        return node;
    }
}

function buildGraph(g) {

    const vizGraph = graphviz.digraph('G');

    for (const [name] of g.entries()) {
        getFromCache(name, vizGraph);
    }

    for (const [name, links] of g.entries()) {
        let totalLinksCount = 0;

        for (const [k, v] of links.entries()) {
            totalLinksCount += v;
        }

        if (totalLinksCount > 20) {
            continue
        }

        console.log(`Total links count of ${k} is ${totalLinksCount}`);

        for (const [lName] of links.entries()) {
            vizGraph.addEdge(getFromCache(name), getFromCache(lName));
        }
    }

    return vizGraph;
}

async function loadParsedArticles(client) {
    const articles = await client.query('SELECT * FROM parsed_xml_data');

    return articles.rows.map(({ txt, header, revision_no }) => ({ txt, title: header, id: revision_no }));
}

function filterGraph(g) {
    for (const [name, links] of g.entries()) {
        for (const [lName, count] of links.entries()) {
            // console.log(name, links, lName, count);
            const reverse = g.get(lName);

            if (reverse) {
                const reverseLinksCount = reverse.get(name) || 0;

                console.log(
                    'Article ', name, ' links to ', lName, ' ', count, ' times',
                    ' but article ', lName, ' links to ', name, ' ', reverseLinksCount, ' times');

                if (reverseLinksCount && count && reverseLinksCount >= count) {

                    console.log(
                        'DELETE Article ', name, ' links to ', lName, ' ', count, ' times',
                        ' but article ', lName, ' links to ', name, ' ', reverseLinksCount, ' times');
                    links.delete(lName);
                }
            }
        }
    }
} 

async function main() {
    await client.connect();

    const articles = await loadParsedArticles(client);

    const graph = new Map();

    console.log('Got ', articles.length, ' articles');

    articles.forEach((article) => {
        if (graph.has(articles.title)) {
            return;
        }

        console.log('Handling article with title', article.title);

        const links = new Map();

        graph.set(article.title, links);

        articles.forEach((a) => {

            if (a.title === article.title) {
                return;
            }

            // const linkRegExp = new RegExp(`\\[\\[.*${a.title.replace(/-/gi, '\\-')}.*\\]\\]`, 'gi');
            
            // console.log(linkRegExp);

            const allLinksInArtcile = (a.txt.match(/\[\[(?:(?!\[\[).)*?\]\]/gi) || []);

            // console.log(allLinksInArtcile);

            const l = allLinksInArtcile.filter((t) => {
                // console.log(typeof t, t);

                const catRegxpMath = /Категория/.test(t);

                if (catRegxpMath) {
                    // console.log('Matched cat', t);
                    return false;
                }

                const multiLangRegexpMatch = /(it:|de:|es:|fr:|hu:|nl:|no:|pl:|pt:|uk:|ja:|fa:|fi:|he:|lt:|sv:|tr:")/gi.test(t);

                if (multiLangRegexpMatch) {
                    // console.log('Found multilang', t);
                    return false;
                }

                const fileRegexpMatch = /Файл:/gi.test(t);

                if (fileRegexpMatch) {
                    // console.log('Found file', t);
                    return false;
                }

                const wikiRegexp = /wikipedia:ru:/g.test(t);
                
                if (wikiRegexp) {
                    // console.log('Found file', t);
                    return false;
                }

                const regexp = new RegExp(`${article.title.replace(/-/g, '\\-')}`, 'gi');

                const matched = regexp.test(t);

                if (matched) {
                    // console.log('Matched in ', t, 'by regexp', regexp);
                }
                return matched;
            });
            

            if (l.length) {
                // console.log(article.title, 'links to -> ', a.title, 'matches are', l);
                links.set(a.title, l.length);
            }
        });

        console.log('Article - ', article.title, 'links to ', links);
    });

    filterGraph(graph);

    const g = buildGraph(graph);

    const d = g.to_dot();

    await fs.promises.writeFile('./test_small.txt', d);
}

main()
    .catch((err) => {
        console.error(err);
    })
    .finally(() => {
        client.end().catch((err) => {
            console.error(err);
        });
    });

function generateRandomNumber(min, max) {
   return Math.floor(Math.random() * (max - min) + min);
};
