const { client } = require('./db');
const graphviz = require('graphviz');
const fs = require('fs');

function buildGraph(g) {

    const vizGraph = graphviz.digraph('G');

    for (const [name, links] of g.entries()) {
        const n = vizGraph.addNode(name);

        for (const [lName] of links.entries()) {
           vizGraph.addEdge(n, lName);
        }
    }

    return vizGraph;
}

async function loadParsedArticles(client) {
    const articles = await client.query('SELECT * FROM parsed_xml_data');

    return articles.rows.map(({ txt, header }) => ({ txt, title: header }));
}

function filterGraph(g) {
    for (const [name, links] of g.entries()) {
        for (const [lName, count] of links.entries()) {
            const reverse = g.get(lName);
            if (reverse) {
                const reverseLinksCount = reverse.get(name);

                if (reverseLinksCount && reverseLinksCount >= count) {
                    console.log('rev lins count more', name + ':' + reverseLinksCount);
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

    articles.forEach((article) => {
        if (graph.has(articles.title)) {
            return;
        }

        const links = new Map();

        graph.set(article.title, links);

        articles.forEach((a) => {
            if (a.title === article.title) {
                return;
            }

            const linkRegExp = new RegExp(`\[\[${a.title.replace(/-/gi, '\\-')}\]\]`, 'gi');

            let l;
            try {
                l = a.txt.match(linkRegExp) || [];
            } catch (err) {
                l = [];
            }
            

            if (l.length) {
                links.set(a.title, l.length);
            }
        });
    });

    filterGraph(graph);

    const g = buildGraph(graph);

    const d = g.to_dot();

    await fs.promises.writeFile('./testLarge.txt', d);
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
