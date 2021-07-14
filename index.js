import natural from 'natural'
import stopwords from 'stopwords'
import fs from 'fs'
import {FakeDB} from './fakedb.js'
import * as hyper from './hyperdb.js'
const tokenizer = new natural.AggressiveTokenizer()

let start = Date.now()
const log = console.log
console.log = (...args) => {
  if (args[0]?.ts) {
    let now = Date.now()
    log(...args.slice(1), `(${now - start}ms)`)
    start = now
  } else {
    log(...args)
  }
}

const DATABASE = 'hyper'
const ALL_DBS = []
const NUM_DBS = Number(process.argv[2])
const DB_FOR = docid => ALL_DBS[docid % NUM_DBS]
const QUERIES = [
  'good',
  'priest',
  'evening morning',
  'jacob isaac david',
  'to be or not to be',
  'comets importing',
  'comets importing change of times and states',
  'how about a long query full of words which may or may not hit a bible verse?'
]
if (DATABASE === 'hyper') await hyper.setup()
for (let i = 0; i < NUM_DBS; i++) {
  if (DATABASE === 'fake') {
    ALL_DBS.push(new FakeDB())
  } else if (DATABASE === 'hyper') {
    ALL_DBS.push(hyper.create())
  }
}

console.log('Reading documents...')
const DOCS = fs.readdirSync(`./corpus`).map(name => fs.readFileSync(`./corpus/${name}`, 'utf8').split(`\n`).filter(line => !!line.trim() && !line.startsWith('#'))).flat()
console.log({ts: true}, `Done (${DOCS.length} documents)`)
console.log('Indexing (this may take multiple minutes)...')
for (let i = 0; i < DOCS.length; i++) {
  await index(i, DOCS[i])
}
for (let db of ALL_DBS) {
  for (let k in db._idxcache) {
    await db.tx.put(k, db._idxcache[k])
  }
  await db.tx.flush()
}
console.log({ts: true}, 'Done')

for (let query of QUERIES) {
  for (let i = 0; i < 5; i++) {
    console.log(i+1, 'of', query)
    const results = await search(query)
    console.log({ts: true}, `Done: ${results.length} results`)
    if (i === 0) console.log(results)
  }
}
process.exit(0)

/*const tokens = toTokens(`
In information retrieval, tf–idf, TF*IDF, or TFIDF, short for term frequency–inverse document frequency, is a numerical statistic that is intended to reflect how important a word is to a document in a collection or corpus.[1] It is often used as a weighting factor in searches of information retrieval, text mining, and user modeling. The tf–idf value increases proportionally to the number of times a word appears in the document and is offset by the number of documents in the corpus that contain the word, which helps to adjust for the fact that some words appear more frequently in general. tf–idf is one of the most popular term-weighting schemes today. A survey conducted in 2015 showed that 83% of text-based recommender systems in digital libraries use tf–idf.[2]

Variations of the tf–idf weighting scheme are often used by search engines as a central tool in scoring and ranking a document's relevance given a user query. tf–idf can be successfully used for stop-words filtering in various subject fields, including text summarization and classification. 
`)

const query = process.argv.slice(2)
for (let queryToken of toTokens(query)) {
  if (tokens.includes(queryToken)) {
    console.log('hit', queryToken)
  }
}*/


function toTokens (str) {
  let arr = Array.isArray(str) ? str : tokenizer.tokenize(str)
  return [...new Set(arr.map(token => token.toLowerCase()).filter(token => !stopwords.english.includes(token)))].map(token => natural.PorterStemmer.stem(token))
}

async function index (id, text) {
  const db = DB_FOR(id)
  
  // const tx = DB_FOR(id).batch()
  if (!db.tx) db.tx = db.batch()
  if (!db._idxcache) db._idxcache = {}
  const tx = db.tx

  await tx.put(`docs:${id}`, {text})
  for (let token of toTokens(text)) {
    // const item = await db.get(`idx:${token}`)
    // const value = item?.value || {docIds: []}
    const value = db._idxcache[`idx:${token}`] || {docIds: []}
    value.docIds.push(id)
    db._idxcache[`idx:${token}`] = value
    // await tx.put(`idx:${token}`, value)
  }
  // await tx.flush()
}

async function search (query, limit = 10) {
  const queryTokens = toTokens(query)
  const getsPromises = []
  for (let db of ALL_DBS) {
    for (let qt of queryTokens) {
      getsPromises.push(db.get(`idx:${qt}`))
    }
  }
  const getResults = await Promise.all(getsPromises)
  const docIdHits = {}
  for (let item of getResults) {
    if (!item) continue
    const docIds = item.value ? item.value.docIds : item.docIds
    if (!docIds?.length) continue
    for (let docId of docIds) {
      docIdHits[docId] = (docIdHits[docId] || 0) + 1
    }
  }
  const docIdsSorted = Object.keys(docIdHits).sort((a, b) => docIdHits[b] - docIdHits[a])
  return Promise.all(docIdsSorted.slice(0, limit).map(docId => DB_FOR(docId).get(`docs:${docId}`)))
}

